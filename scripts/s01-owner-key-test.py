#!/usr/bin/env python3
"""Local cryptographic/closed-recovery checks in a disposable private tmpfs fixture."""
import copy
import json
import os
from pathlib import Path
import subprocess
import tempfile
from s01_owner_key import initialize, verify, verify_mounts

os.umask(0o077)
cases = 0


def refused(work):
    global cases
    try:
        work()
        raise RuntimeError('UNEXPECTED_ACCEPTANCE')
    except (AssertionError, OSError, subprocess.CalledProcessError):
        cases += 1


with tempfile.TemporaryDirectory(prefix='s01-key-test-', dir='/dev/shm') as temporary:
    private = Path(temporary)
    root = Path('/synthetic-test-root')
    private.chmod(0o777)
    refused(lambda: initialize(private, root))
    assert not (private / 'owner-signing').exists(), 'Private identity created before permission check'
    private.chmod(0o700)
    fingerprint = initialize(private, root)
    assert verify(private, root, fingerprint) == fingerprint
    cases += 1
    refused(lambda: initialize(private, root))
    refused(lambda: verify(private, root, '0' * 64))
    refused(lambda: verify(private, Path('/foreign'), fingerprint))
    for filename in ['private.pem', 'public.pem', 'initialized.json']:
        path = private / 'owner-signing' / filename
        content = path.read_bytes()
        path.unlink()
        refused(lambda: verify(private, root, fingerprint))
        path.write_bytes(content)
        path.chmod(0o400)
        path.chmod(0o600)
        refused(lambda: verify(private, root, fingerprint))
        path.chmod(0o400)
    key = private / 'owner-signing/private.pem'
    signer = private / 'owner-signing'
    config = {'services': {'identity-coordinator': {'volumes': [{'type': 'bind',
              'source': str(signer / 'public.pem'), 'read_only': True}]}}}
    verify_mounts(config, private)
    cases += 1
    for source in [str(key), str(signer), str(private), '/dev/shm', '/']:
        unsafe = copy.deepcopy(config)
        unsafe['services']['identity-coordinator']['volumes'].append({'type': 'bind', 'source': source, 'read_only': True})
        refused(lambda: verify_mounts(unsafe, private))
    unsafe = copy.deepcopy(config)
    unsafe['services']['identity-coordinator']['volumes'][0]['read_only'] = False
    refused(lambda: verify_mounts(unsafe, private))
    refused(lambda: verify_mounts({'services': {'foreign': config['services']['identity-coordinator']}}, private))
    refused(lambda: verify_mounts({'services': {}}, private))
    # Actual Ed25519 signing and verification, without displaying the key/signature.
    message = private / 'message'
    message.write_bytes(b'S01 synthetic deterministic test payload')
    signature = private / 'signature'
    subprocess.run(['openssl', 'pkeyutl', '-sign', '-rawin', '-inkey', str(key), '-in', str(message),
                    '-out', str(signature)], check=True, capture_output=True)
    subprocess.run(['openssl', 'pkeyutl', '-verify', '-rawin', '-pubin', '-inkey', str(signer / 'public.pem'),
                    '-in', str(message), '-sigfile', str(signature)], check=True, capture_output=True)
    cases += 1

print(json.dumps({'ownerKeyCasesPassed': cases, 'temporaryTmpfsFixtureOnly': True, 'servicesStarted': 0}))
