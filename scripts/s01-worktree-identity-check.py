#!/usr/bin/env python3
"""Read-only identity gate. Run before downloads, private files or Docker."""
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys

ALLOWED = {'s01-espace-isole': 'feat/s01-espace-isole', '71-s01-t05': 'feat/71-s01-t05'}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def no_symlink(path):
    path = Path(path)
    if not path.is_absolute():
        path = Path.cwd() / path
    current = Path(path.anchor)
    for component in path.parts[1:]:
        if component == '..':
            require(current.is_dir(), 'PATH_COMPONENT_REFUSED')
            current = current.parent
        else:
            current = current / component
            require(not current.is_symlink(), 'SYMLINK_REFUSED')
    return current


def protected(path, mode, directory=False, optional=False):
    path = no_symlink(path)
    try:
        info = path.lstat()
    except FileNotFoundError:
        require(optional, 'PRIVATE_PATH_MISSING')
        return False
    require(info.st_uid == os.getuid(), 'PRIVATE_PATH_OWNER_REFUSED')
    require(stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode),
            'PRIVATE_PATH_TYPE_REFUSED')
    require(stat.S_IMODE(info.st_mode) == mode, 'PRIVATE_PATH_MODE_REFUSED')
    return True


def check(root):
    root = no_symlink(root)
    require(os.getuid() > 0, 'NONROOT_OWNER_REQUIRED')
    require(root.name in ALLOWED, 'WORKTREE_NAME_REFUSED')
    # Ignore caller Git overrides, which can otherwise redirect every identity query.
    require(not any(key.startswith('GIT_') and key not in {'GIT_PAGER', 'GIT_TERMINAL_PROMPT'} for key in os.environ), 'GIT_OVERRIDE_REFUSED')

    def git(*args):
        return subprocess.check_output(['git', '-C', str(root), *args], text=True,
                                       stderr=subprocess.DEVNULL, timeout=5).strip()

    require(git('rev-parse', '--show-toplevel') == str(root), 'WORKTREE_ROOT_REFUSED')
    require(git('branch', '--show-current') == ALLOWED[root.name], 'WORKTREE_BRANCH_REFUSED')
    git_dir = no_symlink(git('rev-parse', '--absolute-git-dir'))
    common = no_symlink(git('rev-parse', '--path-format=absolute', '--git-common-dir'))
    require((root / '.git').is_file() and not (root / '.git').is_symlink()
            and git_dir != common and git_dir.parent == common / 'worktrees', 'LINKED_WORKTREE_REQUIRED')
    require(root.parent == common.parent / 'worktrees', 'WORKTREE_LOCATION_REFUSED')
    require((git_dir / 'gitdir').read_text().strip() == str(root / '.git'), 'WORKTREE_BACKLINK_REFUSED')
    entries = git('worktree', 'list', '--porcelain').split('\n\n')
    require(any(f'worktree {root}\n' in entry + '\n'
                and f'branch refs/heads/{ALLOWED[root.name]}' in entry.splitlines()
                for entry in entries), 'WORKTREE_REGISTRATION_REFUSED')
    for filename in ['worktree-setup.sh', 's01-worktree-identity-check.py']:
        script = no_symlink(root / 'scripts' / filename)
        require(script.is_file(), 'SETUP_PATH_REFUSED')
    project = 's01-' + hashlib.sha256(str(root).encode()).hexdigest()[:12]
    private = Path('/dev/shm') / project
    protected(root / '.local', 0o700, directory=True, optional=True)
    state_path = root / '.local/environment.json'
    state_exists = protected(state_path, 0o600, optional=True)
    env_file = root / '.local/compose.env'
    env_exists = protected(env_file, 0o600, optional=True)
    private_exists = protected(private, 0o700, directory=True, optional=True)
    marker = private / 'synthetic.json'
    if private_exists:
        protected(marker, 0o400)
    if state_exists:
        state = json.loads(state_path.read_text())
        require(state.get('root') == str(root) and state.get('project') == project
                and state.get('private') == str(private) and state.get('syntheticOnly') is True,
                'ENVIRONMENT_IDENTITY_REFUSED')
        require(private_exists, 'PRIVATE_PATH_MISSING')
        require(json.loads(marker.read_text()) == {'root': str(root), 'project': project},
                'PRIVATE_MARKER_REFUSED')
        expected = {'S01_ROOT': str(root), 'S01_PRIVATE': str(private), 'S01_PROJECT': project,
                    'S01_UID': str(os.getuid()), 'S01_GID': str(os.getgid()),
                    'S01_PG_PORT': str(state['pgPort']), 'S01_TLS_PORT': str(state['tlsPort'])}
        require(env_exists, 'PRIVATE_PATH_MISSING')
        require(dict(line.split('=', 1) for line in env_file.read_text().splitlines()) == expected,
                'COMPOSE_ENVIRONMENT_REFUSED')
    else:
        require(not private_exists and not (root / '.local/data_pg').exists()
                and not env_exists, 'UNIDENTIFIED_ENVIRONMENT_REFUSED')
    return root


if __name__ == '__main__':
    try:
        require(len(sys.argv) == 2, 'WORKTREE_ROOT_REQUIRED')
        require(no_symlink(sys.argv[0]) == no_symlink(sys.argv[1]) / 'scripts/s01-worktree-identity-check.py',
                'CHECKER_PATH_REFUSED')
        check(sys.argv[1])
        print('Worktree identity verified (read-only).')
    except (RuntimeError, OSError, ValueError, subprocess.SubprocessError) as error:
        # Errors contain identifiers only; never print private file content.
        print(str(error) if isinstance(error, RuntimeError) else 'WORKTREE_IDENTITY_REFUSED', file=sys.stderr)
        sys.exit(1)
