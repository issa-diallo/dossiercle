import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {Pool,Client} from 'pg';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Inngest} from 'inngest';
import {writeAudit,type AuditIntent} from '../src/audit/audit-writer.js';
import {OutboxDispatcher} from '../src/outbox/outbox-dispatcher.js';
const e=JSON.parse(await readFile('.local/environment.json','utf8')) as {private:string;pgPort:number;project:string;syntheticOnly:boolean};
if(!e.syntheticOnly)throw new Error('SYNTHETIC_REQUIRED');
const config={host:'127.0.0.1',port:e.pgPort};
const pool=new Pool({...config,database:'control',user:'control_api',password:(await readFile(`${e.private}/pg/control_api`,'utf8')).trim(),max:2});
const dispatchPool=new Pool({...config,database:'control',user:'control_dispatcher',password:(await readFile(`${e.private}/pg/control_dispatcher`,'utf8')).trim(),max:1});
const eventDb=new Client({...config,database:'inngest',user:'inngest',password:(await readFile(`${e.private}/pg/inngest`,'utf8')).trim()});
const network=JSON.parse((await promisify(execFile)('docker',['inspect','--format','{{json .NetworkSettings.Networks}}',`${e.project}-inngest-1`])).stdout) as Record<string,{IPAddress:string}>;
const address=network[`${e.project}_private`]?.IPAddress;if(!address)throw new Error('PRIVATE_INNGEST_REQUIRED');
const inngest=new Inngest({id:'dossiercle-s01',baseUrl:`http://${address}:8288`,eventKey:(await readFile(`${e.private}/inngest/event-key`,'utf8')).trim(),isDev:false});
beforeAll(()=>eventDb.connect());
afterAll(async()=>{await pool.end();await dispatchPool.end();await eventDb.end();});
const intent=():AuditIntent=>({eventId:randomUUID(),agencyId:null,actorId:randomUUID(),actorType:'service',eventType:'s01.test.v1',resourceId:randomUUID(),version:1n,outcome:'accepted',correlation:randomUUID(),dispatch:true});
async function record(event:AuditIntent,commit:boolean){const c=await pool.connect();await c.query('BEGIN');try{await writeAudit(c,event,'control_audit');await c.query(commit?'COMMIT':'ROLLBACK');}finally{c.release();}}
describe('atomic audit/outbox and real local Inngest publication',()=>{
 it('dispatcher can ack status/attempt but cannot create intent, change version, or mutate audit',async()=>{
  for(const sql of ["INSERT INTO control.outbox(event_id,type,resource_id,version) VALUES($1,'s01.test.v1',$1,1)", 'UPDATE control.outbox SET version=2 WHERE event_id=$1', 'DELETE FROM control.audit_event WHERE event_id=$1']) {
    await expect(dispatchPool.query(sql,[randomUUID()])).rejects.toMatchObject({code:'42501'});
  }
 });
 it('rolls back both audit and outbox atomically',async()=>{const event=intent();await record(event,false);for(const table of ['audit_event','outbox'])expect((await pool.query(`SELECT 1 FROM control.${table} WHERE event_id=$1`,[event.eventId])).rowCount).toBe(0);});
 it('retains intent across publication then ack failure; replay preserves the same logical intent (transport accepts duplicate receipts)',async()=>{
  const event=intent();await record(event,true);
  const dispatcher=new OutboxDispatcher(dispatchPool,inngest);
  // Drain earlier retained synthetic intents before this command, never deleting evidence.
  while((await pool.query("SELECT 1 FROM control.outbox WHERE status='PENDING' AND event_id<$1",[event.eventId])).rowCount)await dispatcher.dispatchOne();
  await expect(dispatcher.dispatchOne(async()=>{throw new Error('SYNTHETIC_AFTER_PUBLISH');})).rejects.toThrow('OUTBOX_UNAVAILABLE');
  expect((await pool.query('SELECT status FROM control.outbox WHERE event_id=$1',[event.eventId])).rows[0].status).toBe('PENDING');
  const restarted=new OutboxDispatcher(dispatchPool,inngest);expect(await restarted.dispatchOne()).toBe(true);
  expect((await pool.query('SELECT status FROM control.outbox WHERE event_id=$1',[event.eventId])).rows[0].status).toBe('DELIVERED');
  // Native persistence may be asynchronous, poll with finite timeout.
  const count=async()=>(await eventDb.query('SELECT count(*)::int AS n FROM events WHERE event_id=$1',[event.eventId])).rows[0].n as number;
  await expect.poll(count,{timeout:5000,interval:50}).toBe(2);
  const events=await eventDb.query('SELECT event_name,event_data FROM events WHERE event_id=$1',[event.eventId]);
  expect(new Set(events.rows.map(row=>row.event_data)).size).toBe(1);
  expect(events.rows.every(row=>row.event_name===event.eventType)).toBe(true);
  expect((await pool.query('SELECT 1 FROM control.outbox WHERE event_id=$1',[event.eventId])).rowCount).toBe(1);
 });
});
