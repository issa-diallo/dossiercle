/** Synthetic process-death harness; never imported by an application launcher. */
import {readFile} from 'node:fs/promises';
import {Pool} from '../../../packages/adapters/dist/postgres/runtime-pool.js';
import {ActivationRepository} from '../../../packages/adapters/dist/postgres/activation.repository.js';
const [agencyId,subjectId,key]=process.argv.slice(2);
const env=JSON.parse(await readFile('.local/environment.json','utf8'));
const registry=JSON.parse(await readFile('.local/fixture-manifests/registry.json','utf8'));
if(!process.send||!env.syntheticOnly||env.root!==process.cwd()||registry.root!==env.root
  ||!registry.t07.some(t=>t.agencyId===agencyId&&t.subjectId===subjectId))throw new Error('T07_SYNTHETIC_PROCESS_REQUIRED');
const pool=new Pool({host:'127.0.0.1',port:env.pgPort,database:'control',user:'control_coordinator',
  password:(await readFile(env.private+'/pg/control_coordinator','utf8')).trim(),max:1});
const client=await pool.connect(),repo=new ActivationRepository();
try{
 await client.query('BEGIN');await client.query('SET LOCAL ROLE control_t07');
 const snapshot=await repo.snapshot(client,agencyId,subjectId);
 if(!snapshot)throw new Error('T07_FIXTURE_MISSING');
 const reservation=await repo.reserve(client,snapshot);
 await repo.finalize(client,{snapshot,reservation,prepared:reservation.prepared,actorId:subjectId,
  idempotencyKey:key,bodyHash:(await import('node:crypto')).createHash('sha256').update('{}').digest('hex'),correlation:reservation.prepared.correlation});
 process.send({stage:'before-commit'});
 await new Promise(resolve=>process.once('message',resolve));
 await client.query('COMMIT');process.send({stage:'after-commit'});
 await new Promise(resolve=>process.once('message',resolve));
}catch{process.send?.({stage:'failed'});process.exitCode=1;}
finally{await client.query('ROLLBACK').catch(()=>{});client.release();await pool.end();}
