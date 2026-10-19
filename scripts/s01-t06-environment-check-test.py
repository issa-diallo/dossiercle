#!/usr/bin/env python3
"""Exercise T06 capability checks using synthetic Compose configuration only."""
import importlib.util
from pathlib import Path

source = Path(__file__).with_name('s01-t06-environment-check.py')
spec = importlib.util.spec_from_file_location('t06_environment', source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


ROOT = Path('/tmp/t06-worktree')
PRIVATE = Path('/dev/shm/t06-private')
def service(mounts=(), **values):
    targets = {
        'fixture-manifests':'/run/s01-fixtures','control_dispatcher':'/run/s01-pg/dispatcher',
        'signing-key':'/run/s01-inngest-signing-key','event-key':'/run/s01-inngest-event-key',
        '.local/node/bin/node': '/s01-node', 'node_modules': '/app/node_modules', 'packages': '/app/packages',
        'apps/api': '/app/apps/api', 'apps/web/dist': '/app/apps/web/dist', 't06-runtime': '/run/s01-t06-runtime',
        't06-migration': '/run/s01-t06-migration',
        't06-provisioner-tls': '/run/s01-t06-tls', 't06-orchestrator-tls': '/run/s01-t06-tls',
        'provisioner': '/run/s01-pg/provisioner', 'provisioner_ddl': '/run/s01-pg/ddl',
        'ca.crt': '/run/s01-t06-ca.crt', 'journal': '/var/lib/s01-journal',
        't06-coordinator-runtime': '/run/s01-t06-runtime', 'pg': '/run/pg',
        'coordinator-config': '/run/s01-coordinator-config', 'owner-public': '/run/s01-owner-public.pem',
        'coordinator-server-crt': '/run/s01-coordinator/server.crt',
        'coordinator-server-key': '/run/s01-coordinator/server.key',
        'coordinator-client-crt': '/run/s01-coordinator/client.crt',
        'coordinator-client-key': '/run/s01-coordinator/client.key',
        'kc-bff': '/run/s01-coordinator/kc-bff', 'kc-identity': '/run/s01-coordinator/kc-identity',
        'kc-importer': '/run/s01-coordinator/kc-importer', 'pi-verifier': '/run/s01-coordinator/pi-verifier-password',
        'session-encryption': '/run/s01-coordinator/session-encryption-key',
        'session-csrf': '/run/s01-coordinator/session-csrf-key',
        'bootstrap-reauth-decoy-key': '/run/s01-coordinator/bootstrap-reauth-decoy-key',
        't07-activation-tls': '/run/s01-t07-activation-tls',
        'coordinator-ca': '/run/s01-coordinator/ca.crt', 'coordinator-pg': '/run/s01-coordinator/pg-password',
        'pg-bootstrap': '/run/s01-pg/bootstrap',
        'pg-init': '/docker-entrypoint-initdb.d/000.sql',
    }
    def path(name):
        if name == 'fixture-manifests': return ROOT / '.local/fixture-manifests'
        if name == 'control_dispatcher': return PRIVATE / 'pg/control_dispatcher'
        if name in {'signing-key','event-key'}: return PRIVATE / 'inngest' / name
        if name == '.local/node/bin/node': return ROOT / name
        if name in {'node_modules', 'packages', 'apps/api'}: return ROOT / name
        if name == 'apps/web/dist': return ROOT / name
        if name == 'journal': return ROOT / '.local/journal'
        if name in {'provisioner', 'provisioner_ddl'}: return PRIVATE / 'pg' / name
        if name == 'ca.crt': return PRIVATE / 'ca/ca.crt'
        if name == 'pg-bootstrap': return PRIVATE / 'pg/bootstrap'
        if name == 'pg-init': return PRIVATE / 'pg/init.sql'
        if name == 'coordinator-config': return PRIVATE / 'coordinator'
        if name == 'owner-public': return PRIVATE / 'owner-signing/public.pem'
        if name.startswith('coordinator-server-'): return PRIVATE / 'coordinator' / ('server.' + name.removeprefix('coordinator-server-'))
        if name.startswith('coordinator-client-'): return PRIVATE / 'coordinator-tls' / ('client.' + name.removeprefix('coordinator-client-'))
        if name == 'kc-bff': return PRIVATE / 'kc/client-s01-bff'
        if name == 'kc-identity': return PRIVATE / 'kc/client-s01-identity'
        if name == 'kc-importer': return PRIVATE / 'kc/client-s01-importer'
        if name == 'pi-verifier': return PRIVATE / 'pi/verifier-password'
        if name == 'session-encryption': return PRIVATE / 'coordinator/session-encryption-key'
        if name == 'session-csrf': return PRIVATE / 'coordinator/session-csrf-key'
        if name == 'bootstrap-reauth-decoy-key': return PRIVATE / 'coordinator/bootstrap-reauth-decoy-key'
        if name == 't07-activation-tls': return PRIVATE / 't07-activation-tls'
        if name == 'coordinator-ca': return PRIVATE / 'ca/ca.crt'
        if name == 'coordinator-pg': return PRIVATE / 'pg/control_coordinator'
        return PRIVATE / name
    return {'volumes': [{'type': 'bind', 'source': str(path(name)), 'target': targets[name],
                         'read_only': readonly} for name, readonly in mounts],
            'tmpfs': ['/tmp'], **values}


base = {
    'services': {
        'postgres': service([('pg-bootstrap', True), ('pg-init', True)]),
        'keycloak': service(),
        'identity-coordinator': service([
            ('.local/node/bin/node', True), ('node_modules', True), ('packages', True), ('apps/api', True), ('apps/web/dist', True),
            ('coordinator-config', True), ('owner-public', True), ('coordinator-server-crt', True),
            ('coordinator-server-key', True), ('coordinator-client-crt', True), ('coordinator-client-key', True),
            ('kc-bff', True), ('kc-identity', True), ('kc-importer', True), ('pi-verifier', True),
            ('session-encryption', True), ('session-csrf', True), ('bootstrap-reauth-decoy-key', True), ('t06-runtime', True),
            ('t07-activation-tls', True),
            ('coordinator-ca', True), ('coordinator-pg', True), ('journal', False),
        ]),
        't06-provisioner': service([
            ('.local/node/bin/node', True), ('node_modules', True), ('packages', True), ('apps/api', True),
            ('t06-runtime', False), ('t06-migration', False), ('t06-provisioner-tls', True),
            ('provisioner', True), ('provisioner_ddl', True), ('ca.crt', True), ('journal', True), ('fixture-manifests',True),
        ], profiles=['t06'], restart='no', read_only=True, networks=['private']),
        't06-orchestrator': service([
            ('.local/node/bin/node', True), ('node_modules', True), ('packages', True), ('apps/api', True),
            ('t06-orchestrator-tls', True), ('ca.crt', True),('fixture-manifests',True),
            ('control_dispatcher',True),('signing-key',True),('event-key',True)],
                                    profiles=['t06'], restart='no', read_only=True,
                                    networks=['private']),
    }
}
assert module.check(base, ROOT, PRIVATE)
for name, mutation in [
    ('runtime secret reaches orchestrator', lambda c: c['services']['t06-orchestrator']['volumes'].append(
        {'type': 'bind', 'source': str(PRIVATE / 't06-runtime'), 'target': '/run/extra', 'read_only': True})),
    ('parent containing credentials reaches orchestrator', lambda c: c['services']['t06-orchestrator']['volumes'].append(
        {'type': 'bind', 'source': str(PRIVATE / 'pg'), 'target': '/run/pg', 'read_only': True})),
    ('runtime source is redirected outside tmpfs', lambda c: next(
        m for m in c['services']['t06-provisioner']['volumes'] if m['target'] == '/run/s01-t06-runtime').update(
            source=str(ROOT / '.local/other/t06-runtime'))),
    ('migration source is redirected outside tmpfs', lambda c: next(
        m for m in c['services']['t06-provisioner']['volumes'] if m['target'] == '/run/s01-t06-migration').update(
            source=str(ROOT / '.local/other/t06-migration'))),
    ('private tmpfs parent reaches coordinator', lambda c: c['services']['identity-coordinator']['volumes'].append(
        {'type': 'bind', 'source': str(PRIVATE), 'target': '/run/private', 'read_only': True})),
    ('owner signing key reaches coordinator', lambda c: c['services']['identity-coordinator']['volumes'].append(
        {'type': 'bind', 'source': str(PRIVATE / 'owner-signing'), 'target': '/run/owner', 'read_only': True})),
    ('DDL credential reaches an unrelated service', lambda c: c['services']['keycloak']['volumes'].append(
        {'type': 'bind', 'source': str(PRIVATE / 'pg/provisioner_ddl'), 'target': '/run/ddl', 'read_only': True})),
    ('postgres receives the entire credential directory', lambda c: c['services']['postgres']['volumes'].append(
        {'type': 'bind', 'source': str(PRIVATE / 'pg'), 'target': '/run/s01-pg', 'read_only': True})),
    ('migration mount becomes writable in coordinator', lambda c: c['services']['identity-coordinator']['volumes'].append(
        {'type': 'bind', 'source': str(PRIVATE / 't06-migration'), 'target': '/run/extra', 'read_only': False})),
    ('provisioner journal becomes writable', lambda c: next(
        m for m in c['services']['t06-provisioner']['volumes'] if m['source'].endswith('/journal')).update(
            read_only=False)),
    ('named volume reaches coordinator', lambda c: c['services']['identity-coordinator']['volumes'].append(
        {'type': 'volume', 'source': 'hidden-secrets', 'target': '/run/hidden'})),
    ('unapproved tmpfs overlays coordinator path', lambda c: c['services']['identity-coordinator']['tmpfs'].append(
        '/run/s01-coordinator')),
    ('public network joins T06 provisioner', lambda c: c['services']['t06-provisioner']['networks'].append('edge')),
    ('UI bundle mount becomes writable', lambda c: next(
        m for m in c['services']['identity-coordinator']['volumes'] if m['target'] == '/app/apps/web/dist').update(read_only=False)),
    ('UI bundle source is widened to the app directory', lambda c: next(
        m for m in c['services']['identity-coordinator']['volumes'] if m['target'] == '/app/apps/web/dist').update(source=str(ROOT / 'apps/web'))),
    ('UI bundle is mounted into the provisioner', lambda c: c['services']['t06-provisioner']['volumes'].append(
        {'type': 'bind', 'source': str(ROOT / 'apps/web/dist'), 'target': '/app/apps/web/dist', 'read_only': True})),
]:
    import copy
    fixture = copy.deepcopy(base)
    mutation(fixture)
    try:
        module.check(fixture, ROOT, PRIVATE)
    except AssertionError:
        continue
    raise AssertionError(f'accepted unsafe config: {name}')
print('T06 mount boundary tests passed: 17 cases; no services started.')
