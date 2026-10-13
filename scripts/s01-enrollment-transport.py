#!/usr/bin/env python3
"""Synthetic mTLS bridge; native remote_user is accepted only from the coordinator."""
import json,os,secrets,subprocess
from pathlib import Path
os.umask(0o077)
root=Path.cwd().resolve();state=json.loads((root/'.local/environment.json').read_text())
assert state['root']==str(root) and state['syntheticOnly'] is True
private=Path(state['private']);directory=private/'coordinator-tls';directory.mkdir(mode=0o700,exist_ok=True)
def run(*args):
    subprocess.run(['openssl',*args],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
marker=directory/'initialized.json'
if marker.exists():
    assert all((directory/name).is_file() for name in ['ca.key','ca.crt','client.key','client.crt']), 'MTLS_IDENTITY_MISSING_NO_REGENERATION'
else:
    assert not any(directory.iterdir()), 'MTLS_PARTIAL_REQUIRES_RECONCILIATION'
    run('req','-x509','-newkey','rsa:3072','-nodes','-days','7','-subj','/CN=S01 synthetic coordinator CA','-keyout',str(directory/'ca.key'),'-out',str(directory/'ca.crt'))
    run('req','-new','-newkey','rsa:3072','-nodes','-subj','/CN=s01-identity-coordinator','-keyout',str(directory/'client.key'),'-out',str(directory/'client.csr'))
    (directory/'client.ext').write_text('basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=clientAuth\n')
    run('x509','-req','-in',str(directory/'client.csr'),'-CA',str(directory/'ca.crt'),'-CAkey',str(directory/'ca.key'),'-set_serial','0x'+secrets.token_hex(16),'-days','7','-extfile',str(directory/'client.ext'),'-out',str(directory/'client.crt'))
    (private/'ingress-tls/coordinator-ca.crt').write_bytes((directory/'ca.crt').read_bytes())
    marker.write_text(json.dumps({'syntheticOnly':True,'subject':'s01-identity-coordinator'}))
    for path in directory.iterdir():path.chmod(0o400)
    (private/'ingress-tls/coordinator-ca.crt').chmod(0o400)
run('verify','-purpose','sslclient','-CAfile',str(directory/'ca.crt'),str(directory/'client.crt'))
assert (private/'ingress-tls/coordinator-ca.crt').read_bytes()==(directory/'ca.crt').read_bytes()
print('Synthetic coordinator mTLS identity verified; no public native route opened.')
