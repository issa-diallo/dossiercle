#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Project exclusions override CLI --exclude with the pinned Vitest workspace.
# Before native V3, select only the historical files positively; default stays full.
mode=${1:-full}
if [[ $# -gt 1 || ( "$mode" != full && "$mode" != --before-activation ) ]]; then exit 2; fi
export PATH="$PWD/.local/node/bin:$PWD/.local/pnpm-native/package:$PATH"
pnpm build:packages
node scripts/s01-fixture-manifests.mjs capture
set +e
pnpm exec vitest run --project integration packages/adapters/test/schema.integration.spec.ts
schema_status=$?
if [[ "$schema_status" == 0 ]]; then
  if [[ "$mode" == --before-activation ]]; then
    pnpm exec vitest run --project integration \
      apps/api/test/agency-creation.integration.spec.ts \
      apps/api/test/auth.integration.spec.ts \
      apps/api/test/invitations.integration.spec.ts \
      apps/api/test/t05-locks.integration.spec.ts \
      packages/adapters/test/authority-journal.integration.spec.ts \
      packages/adapters/test/enrollment-coordinator.integration.spec.ts \
      packages/adapters/test/native-enrollment.integration.spec.ts \
      packages/adapters/test/native-identity.integration.spec.ts \
      packages/adapters/test/outbox.integration.spec.ts \
      packages/adapters/test/owner-confirmation.integration.spec.ts \
      packages/adapters/test/t05-capabilities.integration.spec.ts
  else
    pnpm exec vitest run --project integration --exclude packages/adapters/test/schema.integration.spec.ts
  fi
  runner_status=$?
else
  runner_status=$schema_status
fi
set -e
node scripts/s01-fixture-manifests.mjs capture
exit "$runner_status"
