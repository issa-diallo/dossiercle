import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { writeAudit, type AuditIntent } from '../src/audit/audit-writer.js';

const env=JSON.parse(await readFile('.local/environment.json','utf8')) as {root:string;private:string;pgPort:number;syntheticOnly:boolean};
if(!env.syntheticOnly||env.root!==process.cwd())throw new Error('SYNTHETIC_REQUIRED');
const pool=new Pool({host:'127.0.0.1',port:env.pgPort,database:'control',user:'control_coordinator',
  password:(await readFile(`${env.private}/pg/control_coordinator`,'utf8')).trim(),max:2});
const event=():AuditIntent=>({eventId:randomUUID(),agencyId:null,actorId:randomUUID(),actorType:'human',
  eventType:'synthetic.t05.audit-test',resourceId:randomUUID(),version:1n,outcome:'accepted',correlation:randomUUID(),dispatch:true});
afterAll(()=>pool.end());
describe('T05 real minimal SQL capabilities and audit role',()=>{
  it('runs all41 real PG permission/default/SET/rollback assertions without skips',async()=>{
    const result=await promisify(execFile)(process.execPath,['scripts/s01-t05-postgres-test.mjs']);
    expect(JSON.parse(result.stdout)).toMatchObject({realPostgresCapabilityCasesPassed:41,allFixturesRolledBack:true});
  });
  it('restores T05 explicitly after atomic audit/outbox and preserves its denied authority privileges',async()=>{
    const client=await pool.connect(),intent=event();
    try{
      await client.query('BEGIN');await client.query('SET LOCAL ROLE control_t05');
      await writeAudit(client,intent,'control_audit');
      expect((await client.query('SELECT current_user')).rows[0].current_user).toBe('control_t05');
      await client.query('SET LOCAL ROLE control_coordinator');
      for(const table of ['audit_event','outbox'])expect((await client.query(`SELECT 1 FROM control.${table} WHERE event_id=$1`,[intent.eventId])).rowCount).toBe(1);
      await client.query('SET LOCAL ROLE control_t05');
      await expect(client.query('UPDATE identity.account_authority SET status=status WHERE false')).rejects.toMatchObject({code:'42501'});
    }finally{await client.query('ROLLBACK');client.release();}
    expect((await pool.query('SELECT 1 FROM control.audit_event WHERE event_id=$1',[intent.eventId])).rowCount).toBe(0);
  });
  it('keeps an audit failure aborted until outer rollback; no business query can succeed',async()=>{
    const client=await pool.connect(),intent=event();
    try{
      await client.query('BEGIN');await client.query('SET LOCAL ROLE control_t05');
      await writeAudit(client,intent,'control_audit');
      await expect(writeAudit(client,intent,'control_audit')).rejects.toMatchObject({code:'23505'});
      await expect(client.query('SELECT 1')).rejects.toMatchObject({code:'25P02'});
    }finally{await client.query('ROLLBACK');client.release();}
    for(const table of ['audit_event','outbox'])expect((await pool.query(`SELECT 1 FROM control.${table} WHERE event_id=$1`,[intent.eventId])).rowCount).toBe(0);
  });
});
