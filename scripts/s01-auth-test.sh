#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$PWD/.local/node/bin:$PWD/.local/pnpm-native/package:$PATH"
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.local/playwright-browsers"
bash scripts/worktree-setup.sh --check
pnpm build:api
pnpm exec tsc -p tsconfig.tests.json --noEmit
docker compose --profile identity-runtime --env-file .local/compose.env -f infra/local/compose.yaml up -d --wait --wait-timeout 30 identity-coordinator
docker compose --env-file .local/compose.env -f infra/local/compose.yaml restart identity-coordinator
docker compose --profile identity-runtime --env-file .local/compose.env -f infra/local/compose.yaml up -d --wait --wait-timeout 30 identity-coordinator
node scripts/s01-fixture-manifests.mjs capture
set +e
pnpm exec playwright test tests/auth "$@"
runner_status=$?
set -e
node scripts/s01-fixture-manifests.mjs capture
exit "$runner_status"
