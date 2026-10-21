#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

bash scripts/worktree-setup.sh --check
bash scripts/s01-t07-identity.sh
node scripts/s01-control-migrate.mjs
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:contracts
pnpm exec vitest run --project provisioning \
  packages/adapters/test/t07-capabilities.integration.spec.ts \
  apps/api/test/t07-transport.integration.spec.ts
# The native coordinator owns initialization of the retained application J1.
# Cold provisioning fixtures must not depend on a previous browser test run.
docker compose --profile identity-runtime --env-file .local/compose.env -f infra/local/compose.yaml \
  up -d --wait --wait-timeout 30 identity-coordinator
pnpm test:auth --grep 'T05 native owner MFA'
node scripts/s01-fixture-manifests.mjs capture
pnpm test:provisioning
bash scripts/s01-t06-start.sh
pnpm test:auth
pnpm test:integration
python3 scripts/s01-secret-scan.py --worktree
