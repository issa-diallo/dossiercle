#!/usr/bin/env bash
set -euo pipefail
[[ $# == 1 && ( $1 == --synthetic || $1 == --check ) ]] || { echo 'Usage: worktree-setup.sh --synthetic' >&2; exit 2; }
# Validate lexical invocation before loading any repository Python through that path.
python3 - "$0" <<'PYBOOT'
import os, runpy, stat, sys
from pathlib import Path
try:
    path = Path(sys.argv[1])
    if not path.is_absolute():
        path = Path.cwd() / path
    script = Path(path.anchor)
    for component in path.parts[1:]:
        if component == '..':
            assert script.is_dir(), 'PATH_COMPONENT_REFUSED'
            script = script.parent
        else:
            script = script / component
            assert not script.is_symlink(), 'SYMLINK_REFUSED'
    assert script.name == 'worktree-setup.sh' and script.parent.name == 'scripts', 'SETUP_PATH_REFUSED'
    assert stat.S_ISREG(script.lstat().st_mode), 'SETUP_PATH_REFUSED'
    checker = script.with_name('s01-worktree-identity-check.py')
    assert not checker.is_symlink() and stat.S_ISREG(checker.lstat().st_mode), 'CHECKER_PATH_REFUSED'
    gate = runpy.run_path(str(checker))
    gate['check'](script.parent / '..')
    print('Worktree invocation and identity verified (read-only).')
except Exception as error:
    print(str(error) if isinstance(error, (AssertionError, RuntimeError)) else 'WORKTREE_IDENTITY_REFUSED', file=sys.stderr)
    sys.exit(1)
PYBOOT
cd "$(dirname "$0")/.."
umask 077
if [[ $1 == --check ]]; then
  python3 - <<'PY'
import hashlib, json, os, subprocess, sys
from pathlib import Path
sys.path.insert(0, str(Path.cwd() / "scripts"))
from s01_owner_key import verify, verify_mounts
root = Path.cwd().resolve()
assert os.getuid() > 0, 'Synthetic services require a non-root owner UID'
state = json.loads((root / '.local/environment.json').read_text())
project = 's01-' + hashlib.sha256(str(root).encode()).hexdigest()[:12]
private = Path('/dev/shm') / project
assert state['root'] == str(root) and state['project'] == project and state['syntheticOnly'] is True
assert state['private'] == str(private)
verify(private, root, state.get('ownerConfirmationKeyFingerprint'))
for name in ['t06-runtime', 't06-migration', 't06-provisioner-tls', 't06-orchestrator-tls',
             't06-api-runtime', 't07-activation-tls']:
    from s01_owner_key import protected
    protected(private / name, directory=True, mode=0o700)
for directory in ['t06-provisioner-tls', 't06-orchestrator-tls']:
    for filename in ['server.key', 'server.crt', 'ca.crt']:
        protected(private / directory / filename, mode=0o400)
for filename in ['client.key', 'client.crt', 'ca.crt']:
    protected(private / 't07-activation-tls' / filename, mode=0o400)
assert json.loads((private / 'synthetic.json').read_text()) == {'root': str(root), 'project': project}
expected = {'S01_ROOT': str(root), 'S01_PRIVATE': str(private), 'S01_PROJECT': project, 'S01_UID': str(os.getuid()), 'S01_GID': str(os.getgid()), 'S01_PG_PORT': str(state['pgPort']), 'S01_TLS_PORT': str(state['tlsPort'])}
actual = dict(line.split('=', 1) for line in (root / '.local/compose.env').read_text().splitlines())
assert actual == expected, 'Environment inconsistent: refusing mutation'
config = json.loads(subprocess.check_output(['docker', 'compose', '--profile','*','--env-file', '.local/compose.env', '-f', 'infra/local/compose.yaml', 'config', '--format', 'json'], text=True))
assert config['name'] == project
assert config['services']['keycloak']['user'] == str(os.getuid()) + ':0', 'Keycloak must read only owner-protected synthetic files using the host UID and its native writable image group'
verify_mounts(config, private)
import importlib.util
spec = importlib.util.spec_from_file_location('t06_environment', root / 'scripts/s01-t06-environment-check.py')
t06_environment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(t06_environment)
t06_environment.check(config, root, private)
coordinator = json.loads((private / 'coordinator/config.json').read_text())
assert coordinator['ownerConfirmationPublicKeyFile'] == '/run/s01-owner-public.pem'
assert coordinator['ownerConfirmationKeyFingerprint'] == state['ownerConfirmationKeyFingerprint']
for section in ['volumes', 'networks']:
    for resource in config.get(section, {}).values():
        assert not resource.get('external') and resource['name'].startswith(project + '_')
for service in config['services'].values():
    assert not service.get('privileged') and not service.get('container_name')
    for mount in service.get('volumes', []):
        if mount['type'] == 'bind':
            source = Path(mount['source']).resolve()
            assert source.is_relative_to(root) or source.is_relative_to(private)
    for port in service.get('ports', []):
        assert port['host_ip'] == '127.0.0.1'
        assert int(port['published']) in [state['pgPort'], state['tlsPort']]
PY
  exit 0
fi
if [[ -f .local/environment.json ]]; then
  bash scripts/worktree-setup.sh --check
fi
python3 - <<'PY'
import hashlib, io, json, os, secrets, socket, subprocess, tarfile, sys
import urllib.request
from pathlib import Path

root = Path.cwd().resolve()
assert os.getuid() > 0, 'Synthetic services require a non-root owner UID'
sys.path.insert(0, str(root / 'scripts'))
from s01_owner_key import initialize, verify, protected
manifest = json.loads((root / 'infra/local/versions.json').read_text())
assert manifest['syntheticOnly'] is True and manifest['platform'] == 'linux/amd64'
local = root / '.local'
local.mkdir(mode=0o700, exist_ok=True)
protected(local, directory=True)

state_path = local / 'environment.json'
project = 's01-' + hashlib.sha256(str(root).encode()).hexdigest()[:12]
private = Path('/dev/shm') / project
if state_path.exists():
    protected(state_path, mode=0o600)
    state = json.loads(state_path.read_text())
    assert state['root'] == str(root) and state['project'] == project
    assert (private / 'synthetic.json').is_file(), 'Keys unavailable: reconcile retained databases; never recreate keys blindly'
else:
    assert not private.exists(), 'Resource collision'
    assert not (local / 'data_pg').exists(), 'Unidentified existing database'
    for command in [['docker', 'ps', '-a', '--format', '{{.Names}}'], ['docker', 'network', 'ls', '--format', '{{.Name}}'], ['docker', 'volume', 'ls', '--format', '{{.Name}}']]:
        names = subprocess.check_output(command, text=True).splitlines()
        assert not any(name.startswith(project + '-') or name.startswith(project + '_') for name in names), 'Unidentified Docker resource collision'
    assert 'tmpfs' in subprocess.check_output(['findmnt', '-n', '-o', 'FSTYPE', '/dev/shm'], text=True)
    private.mkdir(mode=0o700)
    protected(private, directory=True)
    with (private / 'synthetic.json').open('x') as marker:
        marker.write(json.dumps({'root': str(root), 'project': project}))
    (private / 'synthetic.json').chmod(0o400)
    owner_fingerprint = initialize(private, root)
    for directory in ['pg', 'kc', 'pi', 'inngest', 'pi-tls', 'ingress-tls', 'kc-tls', 'ca',
                      't06-runtime', 't06-migration', 't06-provisioner-tls',
                      't06-orchestrator-tls', 't06-api-runtime', 't07-activation-tls']:
        (private / directory).mkdir(mode=0o700)
    def secret(directory, name, size=32):
        value = secrets.token_hex(size)
        path = private / directory / name
        path.write_text(value)
        path.chmod(0o400)
        return value
    bootstrap = secret('pg', 'bootstrap')
    passwords = {role: secret('pg', role) for role in ['kc', 'pi', 'inngest', 'control_api', 'control_migrator', 'control_audit', 'control_coordinator', 'control_dispatcher', 'provisioner', 'provisioner_ddl']}
    statements = ['REVOKE CONNECT, TEMP ON DATABASE postgres FROM PUBLIC;', 'REVOKE CONNECT, TEMP ON DATABASE template1 FROM PUBLIC;', 'REVOKE CONNECT, TEMP ON DATABASE template0 FROM PUBLIC;', 'REVOKE CONNECT, TEMP ON DATABASE synthetic_bootstrap FROM PUBLIC;']
    for role, password in passwords.items():
        if role == 'provisioner_ddl':
            statements.append(f"CREATE ROLE {role} LOGIN NOSUPERUSER CREATEDB CREATEROLE NOINHERIT PASSWORD '{password}';")
        else:
            statements.append(f"CREATE ROLE {role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD '{password}';")
    for database, role in [('keycloak', 'kc'), ('privacyidea', 'pi'), ('inngest', 'inngest'), ('control', 'control_migrator')]:
        statements.extend([f'CREATE DATABASE {database} OWNER {role} ALLOW_CONNECTIONS false;', f'REVOKE CONNECT, TEMP ON DATABASE {database} FROM PUBLIC;', f'GRANT CONNECT ON DATABASE {database} TO {role};', f'ALTER DATABASE {database} ALLOW_CONNECTIONS true;'])
    statements.append('GRANT CONNECT ON DATABASE control TO control_api, control_audit, control_coordinator, control_dispatcher, provisioner;')
    statements.append('GRANT CONNECT ON DATABASE postgres TO provisioner_ddl;')
    statements.append('CREATE ROLE control_t05 NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;')
    statements.append('GRANT control_t05 TO control_coordinator WITH INHERIT FALSE, SET TRUE, ADMIN FALSE;')
    statements.append('CREATE ROLE control_t06 NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;')
    statements.append('GRANT control_t06 TO provisioner WITH INHERIT FALSE, SET TRUE, ADMIN FALSE;')
    statements.append('CREATE ROLE control_t07 NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;')
    statements.append('GRANT control_t07 TO control_coordinator WITH INHERIT FALSE, SET TRUE, ADMIN FALSE;')
    statements.append('CREATE ROLE control_t07_local_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;')
    statements.append('GRANT control_t07_local_reader TO provisioner WITH INHERIT FALSE, SET TRUE, ADMIN FALSE;')
    statements.append('GRANT control_audit TO control_api, control_coordinator WITH INHERIT FALSE, SET TRUE;')
    statements.append('GRANT control_audit TO provisioner WITH INHERIT FALSE, SET TRUE, ADMIN FALSE;')
    init = private / 'pg/init.sql'
    init.write_text('\n'.join(statements) + '\n')
    init.chmod(0o400)
    # PI expects exactly 96 raw bytes, not a hex string.
    (private / 'pi/pi-enckey').write_bytes(secrets.token_bytes(96))
    (private / 'pi/pi-enckey').chmod(0o400)
    for name in ['pi-pepper', 'pi-secret']:
        secret('pi', name)
    for name, value in [('pi-db', passwords['pi']), ('pi-uri', f"postgresql+psycopg2://pi:{passwords['pi']}@postgres/privacyidea")]:
        path = private / 'pi' / name
        path.write_text(value)
        path.chmod(0o400)
    secret('inngest', 'event-key')
    secret('inngest', 'signing-key')
    uri = private / 'inngest/pg-uri'
    uri.write_text(f"postgresql://inngest:{passwords['inngest']}@postgres/inngest?sslmode=disable")
    uri.chmod(0o400)
    def openssl(*args):
        subprocess.run(['openssl', *map(str, args)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    ca = private / 'ca'
    openssl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '7', '-subj', '/CN=S01 synthetic CA', '-keyout', ca / 'ca.key', '-out', ca / 'ca.crt')
    for directory, san in [('pi-tls', 'DNS:privacyidea'), ('kc-tls', 'DNS:keycloak'), ('ingress-tls', 'DNS:localhost,IP:127.0.0.1')]:
        target = private / directory
        openssl('req', '-newkey', 'rsa:2048', '-nodes', '-subj', '/CN=' + san.split(':')[1].split(',')[0], '-keyout', target / 'server.key', '-out', target / 'server.csr')
        (target / 'extensions').write_text('subjectAltName=' + san + '\n')
        openssl('x509', '-req', '-in', target / 'server.csr', '-CA', ca / 'ca.crt', '-CAkey', ca / 'ca.key', '-CAcreateserial', '-days', '7', '-extfile', target / 'extensions', '-out', target / 'server.crt')
        (target / 'ca.crt').write_bytes((ca / 'ca.crt').read_bytes())
    for directory, common_name, san in [
        ('t06-provisioner-tls', 't06-provisioner', 'DNS:t06-provisioner'),
        ('t06-orchestrator-tls', 't06-orchestrator', 'DNS:t06-orchestrator'),
    ]:
        target = private / directory
        openssl('req', '-newkey', 'rsa:2048', '-nodes', '-subj', '/CN=' + common_name,
                '-keyout', target / 'server.key', '-out', target / 'server.csr')
        (target / 'extensions').write_text('subjectAltName=' + san + '\nextendedKeyUsage=serverAuth,clientAuth\n')
        openssl('x509', '-req', '-in', target / 'server.csr', '-CA', ca / 'ca.crt',
                '-CAkey', ca / 'ca.key', '-CAcreateserial', '-days', '7',
                '-extfile', target / 'extensions', '-out', target / 'server.crt')
        (target / 'ca.crt').write_bytes((ca / 'ca.crt').read_bytes())
    target = private / 't07-activation-tls'
    openssl('req', '-newkey', 'rsa:2048', '-nodes', '-subj', '/CN=t07-activation',
            '-keyout', target / 'client.key', '-out', target / 'client.csr')
    (target / 'extensions').write_text('subjectAltName=DNS:t07-activation\nextendedKeyUsage=clientAuth\n')
    openssl('x509', '-req', '-in', target / 'client.csr', '-CA', ca / 'ca.crt', '-CAkey', ca / 'ca.key',
            '-CAserial', target / 'ca.srl', '-CAcreateserial', '-days', '7', '-extfile', target / 'extensions', '-out', target / 'client.crt')
    (target / 'ca.crt').write_bytes((ca / 'ca.crt').read_bytes())
    openssl('genrsa', '-out', private / 'pi/pi-audit.key', '2048')
    openssl('rsa', '-in', private / 'pi/pi-audit.key', '-pubout', '-out', private / 'pi/pi-audit.pub')
    config = private / 'kc/keycloak.conf'
    config.write_text(f'db=postgres\ndb-url=jdbc:postgresql://postgres/keycloak\ndb-username=kc\ndb-password={passwords["kc"]}\ndb-pool-max-size=4\ndb-pool-min-size=1\nhttp-enabled=true\nhttp-management-scheme=http\nhttps-certificate-file=/run/s01-kc-tls/server.crt\nhttps-certificate-key-file=/run/s01-kc-tls/server.key\nhostname=https://localhost\nhealth-enabled=true\ntruststore-paths=/run/s01-kc/pi-ca.crt\nlog-level=ERROR\n')
    (private / 'kc/pi-ca.crt').write_bytes((ca / 'ca.crt').read_bytes())
    for file in private.rglob('*'):
        if file.is_file():
            file.chmod(0o400)
    def port():
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            return sock.getsockname()[1]
    state = {'root': str(root), 'project': project, 'private': str(private), 'pgPort': port(), 'tlsPort': port(), 'syntheticOnly': True, 'ownerConfirmationKeyFingerprint': owner_fingerprint}
    with state_path.open('x') as target:
        target.write(json.dumps(state, indent=2) + '\n')
    protected(state_path, mode=0o600)
    (local / 'data_pg').mkdir(mode=0o700)
    (local / 'journal').mkdir(mode=0o700)
verify(private, root, state.get('ownerConfirmationKeyFingerprint'))
def acquire(item, destination):
    if destination.exists():
        content = destination.read_bytes()
    else:
        content = urllib.request.urlopen(item['url'], timeout=60).read()
    assert hashlib.sha256(content).hexdigest() == item['sha256'], 'Artifact checksum mismatch'
    if not destination.exists():
        destination.write_bytes(content)
    return content

for name in ['provider.jar', 'node.tar.xz', 'pi-canary.py', 'uwsgi.tar.gz']:
    acquire(manifest['artifacts'][name], local / name)
node = local / 'node'
if not (node / 'bin/node').exists():
    node.mkdir(exist_ok=True)
    with tarfile.open(local / 'node.tar.xz') as archive:
        for member in archive.getmembers():
            member.name = '/'.join(member.name.split('/')[1:])
            if member.name:
                archive.extract(member, node, filter='data')
native = local / 'pnpm-native'
if not (native / 'package/pnpm').exists():
    native.mkdir(exist_ok=True)
    data = acquire(manifest['artifacts']['pnpm-native'], local / 'pnpm-native.tgz')
    with tarfile.open(fileobj=io.BytesIO(data)) as archive:
        archive.extractall(native, filter='data')
assert subprocess.check_output([str(node / 'bin/node'), '--version'], text=True).strip() == 'v24.21.0'
assert subprocess.check_output([str(native / 'package/pnpm'), '--version'], text=True).strip() == '12.8.1'
wheels = local / 'pi-wheels'
wheels.mkdir(exist_ok=True)
requirements = []
for dependency in manifest['pythonDependencies']:
    assert dependency['url'].endswith('.whl') and dependency['lifecycle'].startswith('wheel only')
    acquire(dependency, wheels / dependency['url'].split('/')[-1])
    requirements.append(f"{dependency['name']}=={dependency['version']} --hash=sha256:{dependency['sha256']}")
(local / 'pi-requirements.txt').write_text('\n'.join(requirements) + '\n')

for item in manifest.get('testTools', []):
    assert item['lifecycle'].startswith('extract data only')
    archive=local/(item['name']+'.deb')
    acquire(item,archive)
    executable=root/item['executablePath']
    if not executable.exists():
        subprocess.run(['dpkg-deb','--extract',str(archive),str(local/'oath-tools')],check=True)
    assert hashlib.sha256(executable.read_bytes()).hexdigest()==item['executableSha256'], 'Private test tool modified'

for name in ['uwsgi-build.ini', 'privacyidea.wsgi']:
    (local / name).write_bytes((root / 'infra/identity' / name).read_bytes())

(local / '.dockerignore').write_text('*\n!pi-wheels/\n!pi-wheels/**\n!pi-requirements.txt\n!pi-canary.py\n!uwsgi.tar.gz\n!uwsgi-build.ini\n!privacyidea.wsgi\n')

assert json.loads((private / 'synthetic.json').read_text()) == {'root': str(root), 'project': project}
env = {'S01_ROOT': str(root), 'S01_PRIVATE': str(private), 'S01_PROJECT': project, 'S01_UID': str(os.getuid()), 'S01_GID': str(os.getgid()), 'S01_PG_PORT': str(state['pgPort']), 'S01_TLS_PORT': str(state['tlsPort'])}
if (local / 'compose.env').exists():
    protected(local / 'compose.env', mode=0o600)
(local / 'compose.env').write_text('\n'.join(f'{key}={value}' for key, value in env.items()) + '\n')
print(f"Synthetic project {project}; TLS localhost:{state['tlsPort']}; PostgreSQL localhost:{state['pgPort']}")
print(f"Synthetic owner UID {os.getuid()}; Keycloak uses this UID with native image GID 0, without root UID or relaxed secret modes")
print('Connection budget: tenants16 + central8 + KC4 + PI2 + Inngest4 + migrations2 + reserve20 = 56/100; below80')
PY
python3 scripts/s01-enrollment-transport.py
python3 scripts/s01-coordinator-setup.py
docker compose --env-file .local/compose.env -f infra/local/compose.yaml config --quiet
python3 - <<'PY'
import importlib.util, json, subprocess
from pathlib import Path
root = Path.cwd().resolve()
private = Path(json.loads((root / '.local/environment.json').read_text())['private'])
config = subprocess.check_output(['docker', 'compose', '--profile', '*', '--env-file', '.local/compose.env',
                                  '-f', 'infra/local/compose.yaml', 'config', '--format', 'json'], text=True)
path = Path('.local/t06-compose-check.json')
path.write_text(config)
spec = importlib.util.spec_from_file_location('t06_environment', 'scripts/s01-t06-environment-check.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.check(json.loads(config), root, private)
PY
python3 scripts/s01-t06-environment-check.py .local/t06-compose-check.json
rm .local/t06-compose-check.json
bash scripts/worktree-setup.sh --check
if [[ -f package.json ]]; then
  [[ -f pnpm-lock.yaml ]] || { echo 'Missing application lockfile.' >&2; exit 1; }
  python3 - <<'PY'
import hashlib, json
from pathlib import Path
manifest = json.loads(Path('infra/local/versions.json').read_text())
assert hashlib.sha256(Path('pnpm-lock.yaml').read_bytes()).hexdigest() == manifest['pnpmLockSha256']
assert manifest['npmDependencies'] and manifest['lifecycleAllowlist'] == []
PY
  export PATH="$PWD/.local/node/bin:$PWD/.local/pnpm-native/package:$PATH"
  pnpm install --frozen-lockfile --ignore-scripts --store-dir .local/pnpm-store
  export PLAYWRIGHT_BROWSERS_PATH="$PWD/.local/playwright-browsers"
  pnpm exec playwright install firefox
  python3 - <<'PY'
import hashlib,json
from pathlib import Path
manifest=json.loads(Path('infra/local/versions.json').read_text())
for browser in manifest.get('browserDependencies',[]):
    assert hashlib.sha256(Path(browser['executablePath']).read_bytes()).hexdigest()==browser['executableSha256'], 'Private browser modified'
PY
fi
docker compose --env-file .local/compose.env -f infra/local/compose.yaml build privacyidea
docker compose --env-file .local/compose.env -f infra/local/compose.yaml up -d --wait --wait-timeout 180
if [[ -f packages/adapters/src/postgres/migrate.ts ]]; then
  pnpm build:packages
  node scripts/s01-control-migrate.mjs
  node scripts/s01-t05-capabilities.mjs --check
fi
if [[ -f scripts/s01-identity-setup.py ]]; then
  python3 scripts/s01-identity-setup.py
  python3 scripts/s01-pi-setup.py
fi
echo 'Synthetic services and available central migrations started; tests and application gates remain separate.'
