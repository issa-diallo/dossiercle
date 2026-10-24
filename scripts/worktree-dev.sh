#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
case "${1-}" in
  --provisioning)
    [[ $# == 1 ]] || exit 2
    exec bash scripts/s01-t06-start.sh
    ;;
  '') [[ $# == 0 ]] || exit 2 ;;
  *) echo 'Unknown development profile.' >&2; exit 2 ;;
esac
[[ -f .local/compose.env && -f package.json ]] || { echo 'Application/environment unavailable: complete T00/T01 first.' >&2; exit 1; }
bash scripts/worktree-setup.sh --check
export PATH="$PWD/.local/node/bin:$PWD/.local/pnpm-native/package:$PATH"
pnpm build:api
pnpm build:web
docker compose --profile identity-runtime --env-file .local/compose.env -f infra/local/compose.yaml up -d --wait
docker compose --profile identity-runtime --env-file .local/compose.env -f infra/local/compose.yaml restart identity-coordinator
exec docker compose --profile identity-runtime --env-file .local/compose.env -f infra/local/compose.yaml logs --follow identity-coordinator
