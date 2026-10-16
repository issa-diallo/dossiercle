#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "${1-}" == --provisioning ]]; then
  [[ $# == 1 ]] || exit 2
  bash scripts/worktree-setup.sh --check
  export PATH="$PWD/.local/node/bin:$PWD/.local/pnpm-native/package:$PATH"
  exec node scripts/s01-t06-drain.mjs
fi
[[ $# == 0 && -f .local/environment.json && -f .local/compose.env ]] || { echo 'Identified S01 environment required.' >&2; exit 1; }
bash scripts/worktree-setup.sh --check
# Stop only; preserve containers, networks, volumes, journal and keys for explicit recovery.
docker compose --profile '*' --env-file .local/compose.env -f infra/local/compose.yaml stop
echo 'S01 stopped; data, keys and evidence preserved.'
