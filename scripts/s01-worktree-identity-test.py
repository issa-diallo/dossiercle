#!/usr/bin/env python3
"""Real temporary Git worktrees; rejected setup paths cannot reach Docker/secrets."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from unittest.mock import patch

os.umask(0o077)
SOURCE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('identity', SOURCE / 's01-worktree-identity-check.py')
identity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(identity)
cases = 0


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], stderr=subprocess.DEVNULL, text=True)


def accepted(root):
    global cases
    assert identity.check(root) == root
    assert not (root / '.local').exists()
    cases += 1


def refused(root, code, **options):
    global cases
    try:
        identity.check(root)
        raise AssertionError('Unexpected identity acceptance')
    except RuntimeError as error:
        assert str(error) == code, (code, str(error))
    if options.get('setup'):
        result = subprocess.run(['bash', str(root / 'scripts/worktree-setup.sh'), '--synthetic'],
                                cwd=root.parent, capture_output=True, text=True)
        assert result.returncode != 0 and code in result.stderr
        assert not (root / '.local').exists(), 'Rejected setup performed a write'
    cases += 1


with tempfile.TemporaryDirectory(prefix='s01-identity-test-') as temporary:
    repo = Path(temporary) / 'repo'
    repo.mkdir()
    git(repo, 'init', '-b', 'main')
    git(repo, '-c', 'user.name=Synthetic Test', '-c', 'user.email=synthetic@example.invalid',
        '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'synthetic fixture')
    roots = []
    for name, branch in identity.ALLOWED.items():
        root = repo / 'worktrees' / name
        git(repo, 'worktree', 'add', '-b', branch, str(root))
        (root / 'scripts').mkdir()
        for filename in ['worktree-setup.sh', 's01-worktree-identity-check.py']:
            shutil.copyfile(SOURCE / filename, root / 'scripts' / filename)
        accepted(root)
        roots.append(root)
    root = roots[1]
    git(root, 'switch', '--detach')
    refused(root, 'WORKTREE_BRANCH_REFUSED', setup=True)
    git(root, 'switch', '-c', 'feat/foreign')
    refused(root, 'WORKTREE_BRANCH_REFUSED', setup=True)
    git(root, 'switch', 'feat/71-s01-t05')
    git(repo, 'switch', '-c', 'fixture-primary')
    git(root, 'switch', 'main')
    refused(root, 'WORKTREE_BRANCH_REFUSED', setup=True)
    git(root, 'switch', 'feat/71-s01-t05')
    link = Path(temporary) / 'linked'
    link.symlink_to(repo, target_is_directory=True)
    refused(link / 'worktrees/71-s01-t05', 'SYMLINK_REFUSED', setup=True)
    # Inspect a traversed symlink before '..' removes it from a normalized path.
    traversed = root / 'traversed'
    traversed.symlink_to(root / 'scripts', target_is_directory=True)
    refused(traversed / '..', 'SYMLINK_REFUSED')
    result = subprocess.run(['bash', str(traversed / '../scripts/worktree-setup.sh'), '--synthetic'],
                            capture_output=True, text=True)
    assert result.returncode != 0 and 'SYMLINK_REFUSED' in result.stderr
    assert not (root / '.local').exists()
    cases += 1
    traversed.unlink()
    # The entrypoint itself and its checker must both be regular files in this root.
    for filename in ['worktree-setup.sh', 's01-worktree-identity-check.py']:
        script = root / 'scripts' / filename
        saved = script.with_suffix(script.suffix + '.fixture')
        script.rename(saved)
        script.symlink_to(saved)
        refused(root, 'SYMLINK_REFUSED')
        result = subprocess.run(['bash', str(root / 'scripts/worktree-setup.sh'), '--synthetic'],
                                capture_output=True, text=True)
        expected = 'SYMLINK_REFUSED' if filename == 'worktree-setup.sh' else 'CHECKER_PATH_REFUSED'
        assert result.returncode != 0 and expected in result.stderr
        assert not (root / '.local').exists()
        cases += 1
        script.unlink()
        saved.rename(script)
    scripts = root / 'scripts'
    saved_scripts = root / 'saved-scripts'
    scripts.rename(saved_scripts)
    scripts.symlink_to(saved_scripts, target_is_directory=True)
    refused(root, 'SYMLINK_REFUSED', setup=True)
    scripts.unlink()
    saved_scripts.rename(scripts)
    # A valid external working directory does not change the identity being checked.
    result = subprocess.run(['python3', str(root / 'scripts/s01-worktree-identity-check.py'), str(root)],
                            cwd=repo, capture_output=True, text=True)
    assert result.returncode == 0
    cases += 1
    refused(root / 'scripts', 'WORKTREE_NAME_REFUSED')
    refused(repo, 'WORKTREE_NAME_REFUSED')
    # Main root with an allowed basename and branch still is not a linked worktree.
    primary = Path(temporary) / '71-s01-t05'
    git(repo, 'clone', str(repo), str(primary))
    git(primary, 'switch', '-c', 'feat/71-s01-t05')
    refused(primary, 'LINKED_WORKTREE_REQUIRED')
    with patch.dict(os.environ, {'GIT_WORK_TREE': str(repo)}):
        refused(root, 'GIT_OVERRIDE_REFUSED')
    with patch.object(identity.os, 'getuid', return_value=0):
        refused(root, 'NONROOT_OWNER_REQUIRED')
    # A matching branch with a mismatching basename is refused too.
    git(root, 'switch', 'feat/foreign')
    git(roots[0], 'switch', 'feat/71-s01-t05')
    refused(roots[0], 'WORKTREE_BRANCH_REFUSED', setup=True)
    git(roots[0], 'switch', 'feat/s01-espace-isole')
    git(root, 'switch', 'feat/71-s01-t05')
    local = root / '.local'
    local.mkdir()
    (local / 'environment.json').write_text(json.dumps({'root': 'foreign'}))
    refused(root, 'ENVIRONMENT_IDENTITY_REFUSED')
    (local / 'environment.json').unlink()
    local.rmdir()
    git_dir = Path(git(root, 'rev-parse', '--absolute-git-dir').strip())
    backlink = git_dir / 'gitdir'
    original = backlink.read_text()
    backlink.write_text(str(repo / '.git') + '\n')
    refused(root, 'WORKTREE_BACKLINK_REFUSED')
    backlink.write_text(original)
    moved = Path(temporary) / 'outside' / '71-s01-t05'
    moved.parent.mkdir()
    git(repo, 'worktree', 'move', str(root), str(moved))
    refused(moved, 'WORKTREE_LOCATION_REFUSED', setup=True)

print(json.dumps({'realGitWorktreeCasesPassed': cases, 'servicesStarted': 0, 'syntheticSetupStarted': False}))
