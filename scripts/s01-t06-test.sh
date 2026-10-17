#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 - <<'PY'
import json
from pathlib import Path
state=json.loads(Path('.local/environment.json').read_text())
if state.get('syntheticOnly') is not True or state.get('root') != str(Path.cwd().resolve()):
    raise SystemExit('SYNTHETIC_REQUIRED')
PY
python3 scripts/s01-t06-environment-check.py infra/local/compose.yaml
export PATH="$PWD/.local/node/bin:$PWD/.local/pnpm-native/package:$PATH"
pnpm build:api
node scripts/s01-control-migrate.mjs
node scripts/s01-fixture-manifests.mjs capture
# Preserve exhaustive provenance even if an assertion fails after central creation.
finish() {
  local runner_status=$?
  trap - EXIT
  if ! node scripts/s01-t06-drain.mjs; then
    # Stop emitters in this attested private project; retain any uncertain SQL gate.
    docker compose --profile t06 --env-file .local/compose.env -f infra/local/compose.yaml stop t06-orchestrator t06-provisioner || true
    runner_status=1
  fi
  node scripts/s01-fixture-manifests.mjs capture || runner_status=1
  exit "$runner_status"
}
trap finish EXIT
node scripts/s01-t06-drain.mjs
# Separate files are intentional: engine start/stop and host fencing are sequential.
for suite in \
  packages/adapters/test/agency-provisioner.integration.spec.ts \
  packages/adapters/test/t06-capabilities.integration.spec.ts \
  apps/api/test/provisioning.integration.spec.ts \
  apps/api/test/t06-wakeup.integration.spec.ts \
  apps/api/test/t06-admission.integration.spec.ts \
  apps/api/test/tenant-isolation.integration.spec.ts \
  apps/api/test/t06-process.integration.spec.ts \
  apps/api/test/t06-engine.integration.spec.ts; do
  pnpm exec vitest run --project provisioning --bail=1 "$suite"
done
node scripts/s01-t06-drain.mjs
pnpm exec vitest run --project unit --bail=1 \
  packages/adapters/test/secret-store.spec.ts \
  packages/adapters/test/tenant-router.spec.ts \
  packages/adapters/test/provisioning-session.spec.ts \
  packages/adapters/test/provisioning-attempt.spec.ts \
  packages/adapters/test/fixture-manifests.spec.ts \
  packages/domain/test/provisioning.spec.ts
pnpm exec vitest run --project contracts --bail=1 packages/contracts/test/provisioning-events.spec.ts
python3 scripts/s01-t06-secret-scan-test.py
python3 scripts/s01-secret-scan.py --worktree
