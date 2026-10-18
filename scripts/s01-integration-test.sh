#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$PWD/.local/node/bin:$PWD/.local/pnpm-native/package:$PATH"
pnpm build:packages
node scripts/s01-fixture-manifests.mjs capture
set +e
pnpm exec vitest run --project integration packages/adapters/test/schema.integration.spec.ts
schema_status=$?
if [[ "$schema_status" == 0 ]]; then
  pnpm exec vitest run --project integration --exclude packages/adapters/test/schema.integration.spec.ts "$@"
  runner_status=$?
else
  runner_status=$schema_status
fi
set -e
node scripts/s01-fixture-manifests.mjs capture
exit "$runner_status"
