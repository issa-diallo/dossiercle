import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const e=JSON.parse(await readFile('.local/environment.json','utf8'));
if(e.syntheticOnly!==true||e.root!==process.cwd())throw new Error('SYNTHETIC_REQUIRED');
const capabilities=spawnSync(process.execPath,['scripts/s01-t06-capabilities.mjs'],{stdio:'inherit'});
if(capabilities.status!==0)throw new Error('T06_CAPABILITY_BOOTSTRAP_FAILED');
const activationCapabilities=spawnSync(process.execPath,['scripts/s01-t07-capabilities.mjs'],{stdio:'inherit'});
if(activationCapabilities.status!==0)throw new Error('T07_CAPABILITY_BOOTSTRAP_FAILED');
// Use the maintained adapter entrypoint, including all explicit runtime grants.
const result=spawnSync(process.execPath,['packages/adapters/dist/postgres/migrate.js','--synthetic-control'],{stdio:'inherit'});
process.exitCode=result.status??1;
