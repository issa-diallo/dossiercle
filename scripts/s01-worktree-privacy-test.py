#!/usr/bin/env python3
"""Real worktree metadata/mode checks; foreign UID is a separate stat-boundary test."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import tempfile
from unittest.mock import patch

os.umask(0o077)
SOURCE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('identity', SOURCE / 's01-worktree-identity-check.py')
identity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(identity)
cases = 0
simulated_cases = 0


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], text=True, stderr=subprocess.DEVNULL)


def refused(root, code):
    global cases
    # Real CLI rejection in both modes must precede all Docker/download/private work.
    for mode in ['--synthetic', '--check']:
        result = subprocess.run(['bash', str(root / 'scripts/worktree-setup.sh'), mode],
                                capture_output=True, text=True)
        assert result.returncode != 0 and code in result.stderr, (mode, result.stderr)
        cases += 1


with tempfile.TemporaryDirectory(prefix='s01-privacy-test-') as temporary:
    repo = Path(temporary) / 'repo'
    repo.mkdir()
    git(repo, 'init', '-b', 'main')
    git(repo, '-c', 'user.name=Synthetic Test', '-c', 'user.email=synthetic@example.invalid',
        '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'synthetic fixture')
    root = repo / 'worktrees/71-s01-t05'
    git(repo, 'worktree', 'add', '-b', 'feat/71-s01-t05', str(root))
    (root / 'scripts').mkdir()
    for filename in ['worktree-setup.sh', 's01-worktree-identity-check.py']:
        shutil.copyfile(SOURCE / filename, root / 'scripts' / filename)
    local = root / '.local'
    local.mkdir(mode=0o700)
    assert identity.check(root) == root
    cases += 1
    for mode in [0o755, 0o777, 0o1700]:
        local.chmod(mode)
        refused(root, 'PRIVATE_PATH_MODE_REFUSED')
        assert stat.S_IMODE(local.stat().st_mode) == mode, 'Gate silently repaired mode'
        assert not list(local.iterdir()), 'Cold rejected gate created metadata'
    local.chmod(0o700)
    local.rmdir()
    local.write_text('synthetic non-directory fixture')
    refused(root, 'PRIVATE_PATH_TYPE_REFUSED')
    local.unlink()
    local.mkdir(mode=0o700)
    project = 's01-' + hashlib.sha256(str(root).encode()).hexdigest()[:12]
    private = Path('/dev/shm') / project
    assert not private.exists(), 'Test collision; refusing to touch existing resource'
    private.mkdir(mode=0o700)
    try:
        state = {'root': str(root), 'project': project, 'private': str(private), 'syntheticOnly': True,
                 'pgPort': 34567, 'tlsPort': 34568}
        environment = local / 'environment.json'
        environment.write_text(json.dumps(state))
        marker = private / 'synthetic.json'
        marker.write_text(json.dumps({'root': str(root), 'project': project}))
        marker.chmod(0o400)
        env_file = local / 'compose.env'
        env = {'S01_ROOT': str(root), 'S01_PRIVATE': str(private), 'S01_PROJECT': project,
               'S01_UID': str(os.getuid()), 'S01_GID': str(os.getgid()),
               'S01_PG_PORT': '34567', 'S01_TLS_PORT': '34568'}
        env_file.write_text('\n'.join(f'{key}={value}' for key, value in env.items()) + '\n')
        assert identity.check(root) == root
        cases += 1
        # Invalid content would fail JSON if any check read it before validating modes.
        for target, expected_mode in [(local, 0o700), (environment, 0o600), (env_file, 0o600),
                                      (private, 0o700), (marker, 0o400)]:
            original = target.read_bytes() if target.is_file() else None
            if original is not None:
                target.chmod(0o600)
                target.write_text('NOT JSON OR ENV: synthetic fixture')
            target.chmod(0o777)
            refused(root, 'PRIVATE_PATH_MODE_REFUSED')
            assert stat.S_IMODE(target.stat().st_mode) == 0o777
            target.chmod(0o700 if original is None else 0o600)
            if original is not None:
                target.write_bytes(original)
            target.chmod(expected_mode)
        # UID0 cannot be created by this nonroot process: simulate only its stat boundary.
        for target in [local, environment, env_file, private, marker]:
            original_lstat = Path.lstat

            def foreign_lstat(path, *args, **kwargs):
                info = original_lstat(path, *args, **kwargs)
                if path == target:
                    values = list(info)
                    values[4] = os.getuid() + 1
                    return os.stat_result(values)
                return info

            with patch.object(Path, 'lstat', foreign_lstat):
                try:
                    identity.check(root)
                    raise AssertionError('Foreign UID was accepted')
                except RuntimeError as error:
                    assert str(error) == 'PRIVATE_PATH_OWNER_REFUSED'
            simulated_cases += 1
        # Type confusion is refused before opening retained metadata.
        for target, expected_mode in [(environment, 0o600), (env_file, 0o600), (marker, 0o400)]:
            original = target.read_bytes()
            target.unlink()
            target.mkdir(mode=expected_mode)
            refused(root, 'PRIVATE_PATH_TYPE_REFUSED')
            target.rmdir()
            target.write_bytes(original)
            target.chmod(expected_mode)
        original_marker = marker.read_bytes()
        marker.unlink()
        private.rmdir()
        private.write_text('synthetic non-directory fixture')
        refused(root, 'PRIVATE_PATH_TYPE_REFUSED')
        private.unlink()
        private.mkdir(mode=0o700)
        marker.write_bytes(original_marker)
        marker.chmod(0o400)
        assert identity.check(root) == root
        cases += 1
        assert set(private.iterdir()) == {marker}, 'Rejected setup touched private resources'
    finally:
        # Only the freshly created test marker/directory are removed, never retained data.
        (private / 'synthetic.json').unlink()
        private.rmdir()

print(json.dumps({'realWorktreePrivacyCasesPassed': cases, 'simulatedForeignUidCasesPassed': simulated_cases,
                  'servicesStarted': 0, 'syntheticEnvironmentStarted': False}))
