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
pnpm test:provisioning
pnpm test:auth
pnpm test:integration
python3 scripts/s01-secret-scan.py --worktree
