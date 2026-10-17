#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ $# == 0 ]] || exit 2
python3 scripts/s01-worktree-identity-check.py "$PWD"
python3 scripts/s01-t06-environment-check.py infra/local/compose.yaml
export PATH="$PWD/.local/node/bin:$PWD/.local/pnpm-native/package:$PATH"
node scripts/s01-fixture-manifests.mjs inspect
node scripts/s01-t06-drain.mjs
pnpm build:api
docker compose --profile t06 --env-file .local/compose.env -f infra/local/compose.yaml up -d --force-recreate --no-deps t06-provisioner t06-orchestrator
# SDK native sync is signed even though the transport remains private.
docker compose --profile t06 --env-file .local/compose.env -f infra/local/compose.yaml exec -T t06-orchestrator /s01-node --input-type=module <<'JS'
import {readFile} from 'node:fs/promises';
import {createHmac} from 'node:crypto';
const key=(await readFile('/run/s01-inngest-signing-key','utf8')).trim();
const body='{}',ts=Math.floor(Date.now()/1000).toString();
const sig=createHmac('sha256',key.replace(/^signkey-[\w]+-/,'' )).update(body).update(ts).digest('hex');
let response;
for(let n=0;n<40;n++){
 try{response=await fetch('http://t06-orchestrator:8288/api/inngest',{method:'PUT',body,
  headers:{'Content-Type':'application/json','x-inngest-signature':`t=${ts}&s=${sig}`},
  signal:AbortSignal.timeout(5000)});if(response.ok)break;}catch{}
 await new Promise(resolve=>setTimeout(resolve,250));
}
if(!response?.ok)throw new Error('T06_NATIVE_SYNC_FAILED');
console.log(JSON.stringify({syntheticOnly:true,nativeSignedSync:true,status:response.status}));
JS
