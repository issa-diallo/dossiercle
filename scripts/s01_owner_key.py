"""Synthetic owner signing identity; private key never belongs to a runtime mount."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import stat


def openssl(*args):
    return subprocess.check_output(['openssl', *map(str, args)], stderr=subprocess.DEVNULL)


def protected(path, directory=False, mode=None):
    info = path.lstat()
    assert not path.is_symlink() and info.st_uid == os.getuid(), 'OWNER_KEY_OWNERSHIP_INVALID'
    assert stat.S_IMODE(info.st_mode) == (mode if mode is not None else (0o700 if directory else 0o400)), 'OWNER_KEY_MODE_INVALID'
    assert stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode), 'OWNER_KEY_TYPE_INVALID'


def verify(private, root, expected):
    protected(private, directory=True)
    assert subprocess.check_output(['findmnt', '-n', '-o', 'FSTYPE', '-T', str(private)], text=True).strip() == 'tmpfs', 'OWNER_KEY_TMPFS_REQUIRED'
    directory = private / 'owner-signing'
    protected(directory, directory=True)
    for name in ['private.pem', 'public.pem', 'initialized.json']:
        protected(directory / name)
    public = openssl('pkey', '-pubin', '-in', directory / 'public.pem', '-outform', 'DER')
    derived = openssl('pkey', '-in', directory / 'private.pem', '-pubout', '-outform', 'DER')
    # RFC8410 SubjectPublicKeyInfo: id-Ed25519 plus a 32-byte key.
    assert public == derived and public[:12].hex() == '302a300506032b6570032100' and len(public) == 44, 'OWNER_KEY_PAIR_INVALID'
    fingerprint = hashlib.sha256(public).hexdigest()
    marker = {'syntheticOnly': True, 'root': str(root), 'fingerprint': fingerprint, 'algorithm': 'Ed25519'}
    assert json.loads((directory / 'initialized.json').read_text()) == marker, 'OWNER_KEY_MARKER_INVALID'
    assert fingerprint == expected, 'OWNER_KEY_FINGERPRINT_CHANGED'
    return fingerprint


def verify_mounts(config, private):
    public_mounts = []
    signer = private / 'owner-signing'
    for name, service in config['services'].items():
        for mount in service.get('volumes', []):
            if mount['type'] != 'bind':
                continue
            source = Path(mount['source']).resolve()
            assert source != signer and not signer.is_relative_to(source), 'OWNER_PRIVATE_DIRECTORY_MOUNTED'
            if source.is_relative_to(signer):
                assert source == signer / 'public.pem' and name == 'identity-coordinator' and mount.get('read_only') is True, 'OWNER_PRIVATE_KEY_MOUNTED'
                public_mounts.append(mount)
    assert len(public_mounts) == 1, 'OWNER_PUBLIC_MOUNT_MISSING'


def initialize(private, root):
    protected(private, directory=True)
    assert 'tmpfs' == subprocess.check_output(['findmnt', '-n', '-o', 'FSTYPE', '-T', str(private)], text=True).strip(), 'OWNER_KEY_TMPFS_REQUIRED'
    directory = private / 'owner-signing'
    # No exist_ok: partial/retained identities require explicit reconciliation.
    directory.mkdir(mode=0o700)
    openssl('genpkey', '-algorithm', 'ED25519', '-out', directory / 'private.pem')
    openssl('pkey', '-in', directory / 'private.pem', '-pubout', '-out', directory / 'public.pem')
    public = openssl('pkey', '-pubin', '-in', directory / 'public.pem', '-outform', 'DER')
    fingerprint = hashlib.sha256(public).hexdigest()
    (directory / 'initialized.json').write_text(json.dumps({'syntheticOnly': True, 'root': str(root),
                                                         'fingerprint': fingerprint, 'algorithm': 'Ed25519'}))
    for file in directory.iterdir():
        file.chmod(0o400)
    return verify(private, root, fingerprint)
