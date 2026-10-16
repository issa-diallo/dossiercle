#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ $# == 1 ]] || { echo 'Select one test suite.' >&2; exit 2; }
case "$1" in
  --unit|--integration|--auth|--contracts|--e2e|--provisioning) suite="test:${1#--}" ;;
  --build) suite=build ;;
  *) echo 'Unknown test suite.' >&2; exit 2 ;;
esac
[[ -f package.json && -f pnpm-lock.yaml && -f .local/compose.env ]] || { echo 'S01 test suite unavailable before T01/T02; no PASS.' >&2; exit 1; }
bash scripts/worktree-setup.sh --check
export PLAYWRIGHT_NO_COPY_PROMPT=1
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.local/playwright-browsers"
export PATH="$PWD/.local/node/bin:$PWD/.local/pnpm-native/package:$PATH"
exec pnpm run "$suite"
