#!/usr/bin/env python3
"""Prepare only isolated synthetic coordinator mounts; never regenerate existing keys."""
import json,os,secrets,subprocess
from pathlib import Path
os.umask(0o077)
root=Path.cwd().resolve();state=json.loads((root/'.local/environment.json').read_text())
assert state['root']==str(root) and state['syntheticOnly'] is True
private=Path(state['private']);directory=private/'coordinator';directory.mkdir(mode=0o700,exist_ok=True)
def run(*args):subprocess.run(['openssl',*args],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
marker=directory/'initialized.json'
if marker.exists():
    assert all((directory/name).is_file() for name in ['server.key','server.crt']), 'COORDINATOR_IDENTITY_MISSING_NO_REGENERATION'
else:
    assert not any(directory.iterdir()), 'COORDINATOR_PARTIAL_REQUIRES_RECONCILIATION'
    run('req','-new','-newkey','rsa:3072','-nodes','-subj','/CN=identity-coordinator','-keyout',str(directory/'server.key'),'-out',str(directory/'server.csr'))
    (directory/'server.ext').write_text('basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=DNS:identity-coordinator\n')
    run('x509','-req','-in',str(directory/'server.csr'),'-CA',str(private/'ca/ca.crt'),'-CAkey',str(private/'ca/ca.key'),'-set_serial','0x'+secrets.token_hex(16),'-days','7','-extfile',str(directory/'server.ext'),'-out',str(directory/'server.crt'))
    marker.write_text(json.dumps({'syntheticOnly':True,'service':'identity-coordinator'}))
    for file in directory.iterdir():file.chmod(0o400)
run('verify','-verify_hostname','identity-coordinator','-CAfile',str(private/'ca/ca.crt'),str(directory/'server.crt'))
if (directory/'config.json').exists():
    assert all((directory/name).is_file() for name in ['session-encryption-key','session-csrf-key']), 'SESSION_KEY_MISSING_NO_REGENERATION'
for name in ['session-encryption-key','session-csrf-key']:
    path=directory/name
    if not path.exists():
        descriptor=os.open(path,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o400)
        with os.fdopen(descriptor,'wb') as target: target.write(secrets.token_bytes(32));target.flush();os.fsync(target.fileno())
    assert path.stat().st_size==32 and path.stat().st_mode&0o077==0, 'SESSION_KEY_INVALID'
config={'syntheticOnly':True,'origin':'https://localhost:'+str(state['tlsPort']),'issuer':'https://localhost:'+str(state['tlsPort']),
 'ownerSubject':'00000000-0000-4000-8000-000000000001','pgHost':'postgres','pgPort':5432,
 'pgPasswordFile':'/run/s01-coordinator/pg-password','caFile':'/run/s01-coordinator/ca.crt',
 'clientCertificateFile':'/run/s01-coordinator/client.crt','clientKeyFile':'/run/s01-coordinator/client.key',
 'certificateFile':'/run/s01-coordinator/server.crt','keyFile':'/run/s01-coordinator/server.key',
 'journalDirectory':'/var/lib/s01-journal/application','keycloakBffSecretFile':'/run/s01-coordinator/kc-bff',
 'keycloakIdentitySecretFile':'/run/s01-coordinator/kc-identity','keycloakImportSecretFile':'/run/s01-coordinator/kc-importer',
 'piVerifierPasswordFile':'/run/s01-coordinator/pi-verifier-password',
 'sessionEncryptionKeyFile':'/run/s01-coordinator/session-encryption-key','sessionCsrfKeyFile':'/run/s01-coordinator/session-csrf-key'}
config_path=directory/'config.json'
if config_path.exists():
    current=json.loads(config_path.read_text())
    previous={key:value for key,value in config.items() if key not in {'issuer','ownerSubject','keycloakBffSecretFile','keycloakIdentitySecretFile','keycloakImportSecretFile','piVerifierPasswordFile','sessionEncryptionKeyFile','sessionCsrfKeyFile'}}
    assert all(current.get(key)==value for key,value in previous.items()),'COORDINATOR_CONFIG_CHANGED'
    for name in ['session-encryption-key','session-csrf-key']:
        assert (directory/name).is_file(), 'SESSION_KEY_MISSING_NO_REGENERATION'
    replacement=config_path.with_name('config.json.next')
    descriptor=os.open(replacement,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o400)
    with os.fdopen(descriptor,'w') as target: target.write(json.dumps(config));target.flush();os.fsync(target.fileno())
    os.replace(replacement,config_path);config_path.chmod(0o400)
else:
    config_path.write_text(json.dumps(config));config_path.chmod(0o400)
print('Synthetic coordinator server identity and file mounts prepared.')
