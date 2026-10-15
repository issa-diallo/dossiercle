#!/usr/bin/env python3
"""Read-only safe runtime evidence, never print Docker environment or key material."""
import hashlib
import json
import os
from pathlib import Path
import runpy
import subprocess

root = Path.cwd()
runpy.run_path(str(root / 'scripts/s01-worktree-identity-check.py'))['check'](root)
state = json.loads((root / '.local/environment.json').read_text())
private = Path(state['private'])
project = state['project']
container = project + '-identity-coordinator-1'
details = json.loads(subprocess.check_output(['docker', 'inspect', container], text=True))[0]
assert details['State']['Health']['Status'] == 'healthy', 'COORDINATOR_NOT_HEALTHY'
signer = private / 'owner-signing'
public_mounts = []
for mount in details['Mounts']:
    source = Path(mount['Source']).resolve()
    assert source != signer and not signer.is_relative_to(source), 'OWNER_PRIVATE_ANCESTOR_MOUNTED'
    if source.is_relative_to(signer):
        assert source == signer / 'public.pem' and mount['RW'] is False, 'OWNER_PRIVATE_MOUNTED'
        assert mount['Destination'] == '/run/s01-owner-public.pem', 'PUBLIC_MOUNT_DESTINATION_INVALID'
        public_mounts.append(mount)
assert len(public_mounts) == 1, 'OWNER_PUBLIC_MOUNT_MISSING'
runtime = r"""
const fs=require('node:fs'),c=require('node:crypto'),assert=require('node:assert/strict');
const config=JSON.parse(fs.readFileSync('/run/s01-coordinator-config/config.json'));
const key=c.createPublicKey(fs.readFileSync('/run/s01-owner-public.pem'));
assert.equal(key.asymmetricKeyType,'ed25519');
const fingerprint=c.createHash('sha256').update(key.export({type:'spki',format:'der'})).digest('hex');
assert.equal(fingerprint,config.ownerConfirmationKeyFingerprint);
assert.equal(fs.existsSync('/run/s01-coordinator-config/private.pem'),false);
console.log(JSON.stringify({runtimePublicKeyVerified:true,fingerprint}));
"""
runtime_result = json.loads(subprocess.check_output(['docker', 'exec', container, '/s01-node', '-e', runtime], text=True))
assert runtime_result['fingerprint'] == state['ownerConfirmationKeyFingerprint']
services = subprocess.check_output(['docker', 'compose', '--profile', 'identity-runtime', '--env-file', '.local/compose.env',
                                    '-f', 'infra/local/compose.yaml', 'ps', '--format', 'json'], text=True)
health = {item['Service']: item['Health'] for item in map(json.loads, services.splitlines())}
assert len(health) == 8 and all(value == 'healthy' for value in health.values()), 'SYNTHETIC_SERVICE_UNHEALTHY'
server = subprocess.check_output(['docker', 'exec', project + '-postgres-1', 'psql', '-U', 'control_migrator',
                                  '-d', 'control', '-tAc', 'SHOW server_version'], text=True).strip()
assert server.startswith('17.9'), 'POSTGRES_VERSION_CHANGED'
fingerprints = {}
for name in ['0001_s01.sql', '0002_s01_runtime_capabilities.sql', '0003_s01_session_scope.sql']:
    fingerprints[name] = hashlib.sha256((root / 'packages/adapters/migrations/control' / name).read_bytes()).hexdigest()
evidence = {'syntheticOnly': True, 'root': str(root), 'project': project, 'ownerUid': os.getuid(),
            'tlsPort': state['tlsPort'], 'pgPort': state['pgPort'], 'privateDirectory': str(private),
            'ownerPublicKeyFingerprint': state['ownerConfirmationKeyFingerprint'],
            'publicKeyMountedReadOnly': True, 'privateKeyOrAncestorMounted': False,
            'runtimePublicKeyVerified': runtime_result['runtimePublicKeyVerified'], 'servicesHealth': health,
            'postgresServerVersion': server, 'migrationFilesSha256': fingerprints}
print(json.dumps(evidence, indent=2))
