#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -f .local/compose.env && -f package.json ]] || { echo 'Application/environment unavailable: complete T00/T01 first.' >&2; exit 1; }
bash scripts/worktree-setup.sh --check
export PATH="$PWD/.local/node/bin:$PWD/.local/pnpm-native/package:$PATH"
pnpm build:api
docker compose --profile identity-runtime --env-file .local/compose.env -f infra/local/compose.yaml up -d --wait
docker compose --profile identity-runtime --env-file .local/compose.env -f infra/local/compose.yaml restart identity-coordinator
exec pnpm --filter @dossiercle/web dev
