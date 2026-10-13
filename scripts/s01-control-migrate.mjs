import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const e=JSON.parse(await readFile('.local/environment.json','utf8'));
if(e.syntheticOnly!==true||e.root!==process.cwd())throw new Error('SYNTHETIC_REQUIRED');
// Use the maintained adapter entrypoint, including all explicit runtime grants.
const result=spawnSync(process.execPath,['packages/adapters/dist/postgres/migrate.js','--synthetic-control'],{stdio:'inherit'});
process.exitCode=result.status??1;
