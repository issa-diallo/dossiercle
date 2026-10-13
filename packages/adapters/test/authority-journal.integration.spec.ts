import { beforeAll,afterAll,describe,it,expect } from 'vitest';
import { Pool } from 'pg';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { readFile,writeFile,mkdir,rename,stat } from 'node:fs/promises';
import { AuthorityJournal } from '../src/journal/authority-journal.js';
import { ControlRepository } from '../src/postgres/control.repository.js';
const e=JSON.parse(await readFile('.local/environment.json','utf8')) as {private:string;pgPort:number;syntheticOnly:boolean};
if(!e.syntheticOnly)throw new Error('SYNTHETIC_REQUIRED');
const pool=new Pool({host:'127.0.0.1',port:e.pgPort,database:'control',user:'control_coordinator',password:(await readFile(`${e.private}/pg/control_coordinator`,'utf8')).trim(),max:4});
const journal=new AuthorityJournal('.local/journal/tests-current');
const runtime=new Pool({host:'127.0.0.1',port:e.pgPort,database:'control',user:'control_api',password:(await readFile(`${e.private}/pg/control_api`,'utf8')).trim(),max:2});
const repository=new ControlRepository(runtime,journal);
const coordinator=new ControlRepository(pool,journal);
beforeAll(()=>journal.initializeSynthetic());afterAll(async()=>{await pool.end();await runtime.end();});
/** Storage fixture only: not a native enrollment proof, never opens a business route or seeds ACTIVE. */
async function confirmedStorageFixture():Promise<string>{
 const subjectId=randomUUID(),commandId=randomUUID();const client=await pool.connect();await client.query('BEGIN');
 try{
  await client.query('INSERT INTO identity.account_authority(subject_id) VALUES($1)',[subjectId]);
  await journal.append(client,{subjectId,commandId,epoch:1n,state:'PENDING'});
  const head=await journal.append(client,{subjectId,commandId,epoch:1n,state:'CONFIRMED'});
  await client.query("UPDATE identity.account_authority SET status='CONFIRMED',confirmed_epoch=1,enrollment_status='VERIFIED',recovery_ready=true,journal_sequence=$2,journal_hash=$3 WHERE subject_id=$1",[subjectId,head.sequence.toString(),head.hash]);
  await client.query('COMMIT');return subjectId;
 }finally{client.release();}
}
describe('J1 remains authoritative with real PG transactions and locks',()=>{
 it('never recreates an initialized journal after loss, including process restart',async()=>{
  const isolated=new AuthorityJournal('.local/journal/loss-fixture-'+randomUUID());await isolated.initializeSynthetic();
  const retained=isolated.path+'.test-retained';await rename(isolated.path,retained);
  try{
   await expect(new AuthorityJournal(isolated.path.slice(0,isolated.path.lastIndexOf('/'))).initializeSynthetic()).rejects.toThrow('JOURNAL_UNAVAILABLE');
   await expect(stat(isolated.path)).rejects.toMatchObject({code:'ENOENT'});
  }finally{await rename(retained,isolated.path);}
 });

 it('refuses the existing-transaction barrier in autocommit, and permits it under BEGIN',async()=>{
  const subject=await confirmedStorageFixture(),client=await runtime.connect();let invoked=false;
  try {
   await expect(repository.withLockedAuthority(client,subject,false,async()=>{invoked=true;})).rejects.toThrow('AUTHORITY_UNAVAILABLE');
   expect(invoked).toBe(false);
   await client.query('BEGIN');expect(await repository.withLockedAuthority(client,subject,false,async()=>true)).toBe(true);await client.query('ROLLBACK');
  }finally{client.release();}
 });
 it('runtime can lock confirmed authority but cannot mutate it or assume migration role',async()=>{
  const subject=await confirmedStorageFixture();
  expect(await repository.withAuthority(subject,false,async()=>true)).toBe(true);
  expect(await repository.withAuthority(subject,true,async()=>true)).toBe(true);
  await expect(runtime.query("UPDATE identity.account_authority SET status='DENIED' WHERE subject_id=$1",[subject])).rejects.toMatchObject({code:'42501'});
  await expect(runtime.query('SET ROLE control_migrator')).rejects.toMatchObject({code:'42501'});
 });
 it('denies old CONFIRMED projection after fsync then upstream/SQL failure; explicit deny can resume',async()=>{
  const subject=await confirmedStorageFixture(),command=randomUUID();
  await expect(coordinator.deny(subject,command,async()=>{throw new Error('SYNTHETIC_AFTER_FSYNC');})).rejects.toThrow('SYNTHETIC_AFTER_FSYNC');
  expect((await pool.query('SELECT status FROM identity.account_authority WHERE subject_id=$1',[subject])).rows[0].status).toBe('CONFIRMED');
  expect((await journal.head(subject))?.state).toBe('PENDING');
  await expect(repository.withAuthority(subject,false,async()=>true)).rejects.toThrow('AUTHORITY_UNAVAILABLE');
  await coordinator.deny(subject,command,async()=>{});await coordinator.deny(subject,command,async()=>{throw new Error('REPLAY_MUST_NOT_CALL');});
  expect((await journal.head(subject))?.state).toBe('DENIED');
  await expect(repository.withAuthority(subject,false,async()=>true)).rejects.toThrow('AUTHORITY_DENIED');
 });
 it('opposes an actual coordinator process crash after J1 fsync and before PostgreSQL commit',async()=>{
  const subject=await confirmedStorageFixture();
  const source=`import{readFile}from'node:fs/promises';import pg from'./packages/adapters/node_modules/pg/lib/index.js';import{AuthorityJournal}from'./packages/adapters/dist/journal/authority-journal.js';import{ControlRepository}from'./packages/adapters/dist/postgres/control.repository.js';const e=JSON.parse(await readFile('.local/environment.json'));const pool=new pg.Pool({host:'127.0.0.1',port:e.pgPort,database:'control',user:'control_coordinator',password:(await readFile(e.private+'/pg/control_coordinator','utf8')).trim(),max:1});await new ControlRepository(pool,new AuthorityJournal('.local/journal/tests-current')).deny(process.env.S01_TEST_SUBJECT,process.env.S01_TEST_COMMAND,async()=>process.exit(71));`;
  await expect(promisify(execFile)(process.execPath,['--input-type=module','-e',source],{env:{...process.env,S01_TEST_SUBJECT:subject,S01_TEST_COMMAND:randomUUID()}})).rejects.toMatchObject({code:71});
  expect((await pool.query('SELECT status FROM identity.account_authority WHERE subject_id=$1',[subject])).rows[0].status).toBe('CONFIRMED');
  expect((await new AuthorityJournal('.local/journal/tests-current').head(subject))?.state).toBe('PENDING');
  await expect(repository.withAuthority(subject,true,async()=>true)).rejects.toThrow('AUTHORITY_UNAVAILABLE');
 });
 it('keeps shared authority lock until sensitive read ends, then denial closes next access',async()=>{
  const subject=await confirmedStorageFixture();let release!:()=>void,entered!:()=>void;
  const ready=new Promise<void>(resolve=>{entered=resolve;}),wait=new Promise<void>(resolve=>{release=resolve;});
  const reader=repository.withAuthority(subject,false,async()=>{entered();await wait;return true;});await ready;
  let converged=false;const deny=coordinator.deny(subject,randomUUID(),async()=>{converged=true;});
  await pool.query('SELECT pg_sleep(0.05)');expect(converged).toBe(false);release();expect(await reader).toBe(true);await deny;
  await expect(repository.withAuthority(subject,false,async()=>true)).rejects.toThrow('AUTHORITY_DENIED');
 });
 it('denies missing journal despite valid central projection',async()=>{
  const subject=await confirmedStorageFixture();const missing=new ControlRepository(runtime,new AuthorityJournal(`.local/journal/missing-${randomUUID()}`));
  await expect(missing.withAuthority(subject,false,async()=>true)).rejects.toThrow('AUTHORITY_UNAVAILABLE');
 });
 it('denies divergent projection and never fixes it into a grant implicitly',async()=>{
  const subject=await confirmedStorageFixture();await pool.query("UPDATE identity.account_authority SET journal_hash=$2 WHERE subject_id=$1",[subject,'f'.repeat(64)]);
  await expect(repository.withAuthority(subject,false,async()=>true)).rejects.toThrow('AUTHORITY_UNAVAILABLE');
  expect((await pool.query('SELECT journal_hash FROM identity.account_authority WHERE subject_id=$1',[subject])).rows[0].journal_hash).toBe('f'.repeat(64));
 });
 it('detects corrupt/truncated journal and refuses confirmation without its pending command',async()=>{
  const dir=`.local/journal/corrupt-${randomUUID()}`;await mkdir(dir,{mode:0o700});await writeFile(`${dir}/authority.jsonl`,'{"truncated":', {mode:0o600});
  await expect(new AuthorityJournal(dir).head(randomUUID())).rejects.toThrow('JOURNAL_UNAVAILABLE');
  const client=await pool.connect();await client.query('BEGIN');
  try{await expect(journal.append(client,{subjectId:randomUUID(),commandId:randomUUID(),epoch:1n,state:'CONFIRMED'})).rejects.toThrow('JOURNAL_CONFIRM_WITHOUT_PENDING');}
  finally{await client.query('ROLLBACK');client.release();}
 });
});
