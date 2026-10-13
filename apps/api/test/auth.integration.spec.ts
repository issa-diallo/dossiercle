import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { controlPool } from '@dossiercle/adapters/postgres/runtime-pool';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { AuthorityJournal } from '@dossiercle/adapters/journal/authority-journal';
import { ControlRepository } from '@dossiercle/adapters/postgres/control.repository';
import { nativeSidKey } from '@dossiercle/adapters/identity/native-sid';
import { SessionCipher } from '@dossiercle/adapters/identity/session-cipher';
import { AuthService, NativeIdentityChanged, NativeSessionEnded, SESSION_COOKIE } from '../src/auth/auth.service.js';

const e=JSON.parse(await readFile('.local/environment.json','utf8')) as {root:string;private:string;pgPort:number;tlsPort:number;syntheticOnly:boolean};
if(!e.syntheticOnly||e.root!==process.cwd())throw new Error('SYNTHETIC_REQUIRED');
const secret=async(role:string)=>(await readFile(e.private+'/pg/'+role,'utf8')).trim();
const pool=controlPool({host:'127.0.0.1',port:e.pgPort,role:'control_coordinator',password:await secret('control_coordinator'),max:2});
const api=controlPool({host:'127.0.0.1',port:e.pgPort,role:'control_api',password:await secret('control_api'),max:2});
const journal=new AuthorityJournal('.local/journal/tests-auth');
const control=new ControlRepository(pool,journal);
const cipher=new SessionCipher(randomBytes(32),randomBytes(32));
const origin='https://localhost:'+e.tlsPort;
beforeAll(()=>journal.initializeSynthetic());
afterAll(async()=>{await pool.end();await api.end();});

// Native verification/refresh are explicit test boundaries. These cases qualify
// real SQL/J1/session transactions; they do not qualify native MFA.
async function fixture(options:{owner?:boolean;nativeFails?:boolean;refreshFails?:boolean;denialCrash?:boolean}={}){
 const subject=randomUUID(),root=randomUUID(),sid=randomBytes(18).toString('base64url'),command=randomUUID();
 let now=new Date();let nativeChecks=0;let refreshes=0;let changed=false;let unavailable=false;let ended=false;
 const effectiveJournal=options.denialCrash?new Proxy(journal,{get(target,key){
  if(key==='append')return async(...args:Parameters<AuthorityJournal['append']>)=>{const head=await target.append(...args);if(args[1].state==='DENIED')throw new Error('SYNTHETIC_CRASH_AFTER_DENIAL_FSYNC');return head;};
  const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
 }}):journal;
 const service=new AuthService({pool,control,journal:effectiveJournal,cipher,origin,ownerSubject:options.owner?subject:randomUUID(),now:()=>now,
  nativeSession:async()=>{nativeChecks++;if(ended)throw new NativeSessionEnded();if(changed)throw new NativeIdentityChanged();if(unavailable)throw new Error('DEPENDENCY_UNAVAILABLE');if(options.nativeFails)throw new Error('SYNTHETIC_NATIVE_CLOSED');},
  nativeRefresh:async(_subject,payload)=>{refreshes++;if(options.refreshFails)throw new Error('SYNTHETIC_REFRESH_CLOSED');return {...payload,tokens:{refresh_token:'synthetic-rotated'}};}});
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  await client.query('INSERT INTO identity.account_authority(subject_id) VALUES($1)',[subject]);
  await journal.append(client,{subjectId:subject,commandId:command,epoch:1n,state:'PENDING'});
  const head=await journal.append(client,{subjectId:subject,commandId:command,epoch:1n,state:'CONFIRMED'});
  await client.query("UPDATE identity.account_authority SET status='CONFIRMED',confirmed_epoch=1,enrollment_status='VERIFIED',recovery_ready=true,journal_sequence=$2,journal_hash=$3 WHERE subject_id=$1",[subject,head.sequence.toString(),head.hash]);
  await client.query('COMMIT');
 }finally{client.release();}
 await api.query(`INSERT INTO control.agency_invitation(id,root_id,subject_id,contact,owner_id,identity_status,status,expires_at)
  VALUES($1,$2,$3,$4,$5,'CONFIRMED','ISSUED',now()+interval '16 days')`,[randomUUID(),root,subject,subject+'@example.invalid',randomUUID()]);
 const nativePayload={sid,acr:'2',issuer:origin+'/realms/dossiercle',tokens:{refresh_token:'synthetic-initial'}};
 const issue=async()=>{
  const client=await pool.connect();try{
   await client.query('BEGIN');await client.query('SELECT root_id FROM control.agency_invitation WHERE root_id=$1 FOR SHARE',[root]);
   const raw=await control.withLockedAuthority(client,subject,true,async()=>await service.issue(client,{subjectId:subject,rootId:root,epoch:1n,scope:options.owner?'platform':'onboarding',nativePayload}));
   await client.query('COMMIT');return SESSION_COOKIE+'='+raw;
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 };
 const cookie=await issue();
 return {subject,root,sid,service,cookie,issue,setEnded:(value:boolean)=>{ended=value;},setChanged:(value:boolean)=>{changed=value;},setUnavailable:(value:boolean)=>{unavailable=value;},advance:(ms:number)=>{now=new Date(now.getTime()+ms);},counts:()=>({nativeChecks,refreshes}),now:()=>now};
}
describe('BFF real PostgreSQL/J1 transactions with explicit synthetic native boundaries',()=>{
 it('commits a durable new epoch denial and revokes all tabs after observed native change',async()=>{
  const f=await fixture();const another=await f.issue();const view=await f.service.session(f.cookie);
  f.setChanged(true);
  await expect(f.service.session(f.cookie)).rejects.toMatchObject({code:'UNAUTHENTICATED'});
  const authority=(await pool.query('SELECT * FROM identity.account_authority WHERE subject_id=$1',[f.subject])).rows[0];
  expect(authority.status).toBe('DENIED');expect(authority.identity_epoch).toBe('2');expect(authority.confirmed_epoch).toBeNull();
  expect((await journal.head(f.subject))?.state).toBe('DENIED');
  expect((await pool.query('SELECT count(*)::int AS n FROM identity.session WHERE subject_id=$1 AND revoked_at IS NULL',[f.subject])).rows[0].n).toBe(0);
  f.setChanged(false); // Restore the previous native answers, never the independent journal.
  await expect(f.service.session(another)).rejects.toThrow();
  let work=0;
  await expect(f.service.withClaimSession(f.cookie,{origin,csrf:view.csrfToken,humanActivity:true},async()=>{work++;})).rejects.toThrow();
  expect(work).toBe(0);
 });
 it('serializes concurrent access behind the committed native change denial',async()=>{
  const f=await fixture();f.setChanged(true);
  const results=await Promise.allSettled([f.service.session(f.cookie),f.service.session(f.cookie)]);
  expect(results.every(result=>result.status==='rejected')).toBe(true);
  expect((await journal.head(f.subject))?.epoch).toBe(2n);
 });
 it('does not permanently deny a subject for a transient dependency failure',async()=>{
  const f=await fixture();const head=await journal.head(f.subject);f.setUnavailable(true);
  await expect(f.service.session(f.cookie)).rejects.toThrow('DEPENDENCY_UNAVAILABLE');
  expect(await journal.head(f.subject)).toEqual(head);
  f.setUnavailable(false);expect((await f.service.session(f.cookie)).scope).toBe('onboarding');
 });
 it('durably closes a positively absent native SID without denying the account',async()=>{
  const f=await fixture();const another=await f.issue();f.setEnded(true);
  await expect(f.service.session(f.cookie)).rejects.toMatchObject({code:'UNAUTHENTICATED'});
  const head=await journal.head(f.subject);expect(head?.state).toBe('CONFIRMED');expect(head?.epoch).toBe(1n);
  f.setEnded(false);await expect(f.service.session(another)).rejects.toMatchObject({code:'UNAUTHENTICATED'});
  await expect(f.issue()).rejects.toMatchObject({code:'UNAUTHENTICATED'});
 });
 it('keeps access closed after denial fsync and before SQL convergence',async()=>{
  const f=await fixture({denialCrash:true});f.setChanged(true);
  await expect(f.service.session(f.cookie)).rejects.toThrow('SYNTHETIC_CRASH_AFTER_DENIAL_FSYNC');
  expect((await journal.head(f.subject))?.state).toBe('DENIED');
  expect((await pool.query('SELECT status,identity_epoch FROM identity.account_authority WHERE subject_id=$1',[f.subject])).rows[0]).toMatchObject({status:'CONFIRMED',identity_epoch:'1'});
  f.setChanged(false);await expect(f.service.session(f.cookie)).rejects.toThrow();
 });
 it('keeps onboarding empty and reserves platform scope to the configured owner',async()=>{
  const f=await fixture();expect(await f.service.session(f.cookie)).toMatchObject({scope:'onboarding',agencyId:null});
  const owner=await fixture({owner:true});expect(await owner.service.session(owner.cookie)).toMatchObject({scope:'platform',agencyId:null});
 });
 it('only the configured strong platform owner can mutate after bootstrap invitation admission expires',async()=>{
  const owner=await fixture({owner:true});await api.query("UPDATE control.agency_invitation SET expires_at=now()-interval '1 second' WHERE root_id=$1",[owner.root]);
  const view=await owner.service.session(owner.cookie);
  await owner.service.withSession(owner.cookie,{origin,csrf:view.csrfToken,humanActivity:true},async()=>{});expect(owner.counts().refreshes).toBe(1);
  const other=new AuthService({pool,control,journal,cipher,origin,ownerSubject:randomUUID(),nativeSession:async()=>{throw new Error('NATIVE_MUST_NOT_RUN');}});
  await expect(other.session(owner.cookie)).rejects.toThrow();
  await pool.query("UPDATE identity.session SET scope='onboarding' WHERE subject_id=$1",[owner.subject]);
  await expect(owner.service.session(owner.cookie)).rejects.toMatchObject({code:'INVITATION_UNAVAILABLE'});
 });
 it('revoked owner bootstrap roots close platform access',async()=>{
  const owner=await fixture({owner:true});await api.query("UPDATE control.agency_invitation SET status='REVOKED' WHERE root_id=$1",[owner.root]);
  await expect(owner.service.session(owner.cookie)).rejects.toMatchObject({code:'INVITATION_UNAVAILABLE'});
 });
 it('polling and parallel tabs do not refresh native SSO or idle activity',async()=>{
  const f=await fixture();const initial=await f.service.session(f.cookie);
  f.advance(29*60_000);const views=await Promise.all([f.service.session(f.cookie),f.service.session(f.cookie)]);
  expect(views.map(v=>v.idleExpiresAt)).toEqual([initial.idleExpiresAt,initial.idleExpiresAt]);expect(f.counts().refreshes).toBe(0);
  f.advance(60_000);await expect(f.service.session(f.cookie)).rejects.toMatchObject({code:'UNAUTHENTICATED'});
 });
 it('refreshes only qualified human activity, encrypts rotated tokens and preserves absolute expiry',async()=>{
  const f=await fixture();await api.query("UPDATE control.agency_invitation SET status='CLAIMED' WHERE root_id=$1",[f.root]);
  const initial=await f.service.session(f.cookie);f.advance(20*60_000);
  await expect(f.service.withSession(f.cookie,{origin:origin+'.invalid',csrf:initial.csrfToken,humanActivity:true},async()=>{})).rejects.toMatchObject({code:'FORBIDDEN'});
  expect(f.counts().refreshes).toBe(0);
  await f.service.withSession(f.cookie,{origin,csrf:initial.csrfToken,humanActivity:true},async()=>{
   expect((await journal.head(f.subject))?.state).toBe('CONFIRMED');
  });
  const current=await f.service.session(f.cookie);expect(f.counts().refreshes).toBe(1);expect(current.absoluteExpiresAt).toBe(initial.absoluteExpiresAt);expect(current.idleExpiresAt>initial.idleExpiresAt).toBe(true);
  const persisted=(await pool.query('SELECT encrypted_oidc_tokens FROM identity.session WHERE subject_id=$1',[f.subject])).rows[0].encrypted_oidc_tokens as string;
  expect(persisted.includes('synthetic-rotated')).toBe(false);
 });
 it('absolute fifteen days expires even after recent human activity',async()=>{
  const f=await fixture();f.advance(15*24*60*60_000);
  await pool.query('UPDATE identity.session SET last_human_activity_at=$2 WHERE subject_id=$1',[f.subject,f.now()]);
  await expect(f.service.session(f.cookie)).rejects.toMatchObject({code:'UNAUTHENTICATED'});
 });
 it('refresh failure persists PENDING J1 and closes the rolled back SQL session',async()=>{
  const f=await fixture({refreshFails:true});const view=await f.service.session(f.cookie);
  await expect(f.service.withClaimSession(f.cookie,{origin,csrf:view.csrfToken,humanActivity:true},async()=>{})).rejects.toThrow('SYNTHETIC_REFRESH_CLOSED');
  expect((await journal.head(f.subject))?.state).toBe('PENDING');await expect(f.service.session(f.cookie)).rejects.toThrow();
 });
 it('logout revokes under J1 without human refresh and is closed on replay',async()=>{
  const f=await fixture();const view=await f.service.session(f.cookie);await f.service.logout(f.cookie,origin,view.csrfToken);
  expect(f.counts().refreshes).toBe(0);expect((await journal.head(f.subject))?.state).toBe('CONFIRMED');
  await expect(f.service.session(f.cookie)).rejects.toMatchObject({code:'UNAUTHENTICATED'});
 });
 it('signed backchannel tuple revokes without depending on active native credentials and is idempotent',async()=>{
  const f=await fixture({nativeFails:true});const input={subject:f.subject,sid:f.sid,jti:randomUUID()};
  await f.service.nativeLogout(input);const before=await journal.head(f.subject);await f.service.nativeLogout(input);
  expect(await journal.head(f.subject)).toEqual(before);expect(f.counts().nativeChecks).toBe(0);
  expect((await pool.query('SELECT revoked_at IS NOT NULL AS revoked FROM identity.session WHERE subject_id=$1',[f.subject])).rows[0].revoked).toBe(true);
 });
 it('an old SQL authority/session snapshot cannot restore a logged out session',async()=>{
  const f=await fixture();const old=(await pool.query('SELECT journal_sequence,journal_hash FROM identity.account_authority WHERE subject_id=$1',[f.subject])).rows[0];
  const view=await f.service.session(f.cookie);await f.service.logout(f.cookie,origin,view.csrfToken);
  await pool.query('UPDATE identity.session SET revoked_at=NULL WHERE subject_id=$1',[f.subject]);
  await pool.query('UPDATE identity.account_authority SET journal_sequence=$2,journal_hash=$3 WHERE subject_id=$1',[f.subject,old.journal_sequence,old.journal_hash]);
  await expect(f.service.session(f.cookie)).rejects.toThrow();
 });
 it('unknown signed SID persists tombstone and prevents later issuance',async()=>{
  const f=await fixture();const sid=randomUUID();await f.service.nativeLogout({subject:null,sid,jti:randomUUID()});
  const client=await pool.connect();try{
   await client.query('BEGIN');
   await expect(f.service.issue(client,{subjectId:f.subject,rootId:f.root,epoch:1n,scope:'onboarding',nativePayload:{sid}})).rejects.toMatchObject({code:'UNAUTHENTICATED'});
  }finally{await client.query('ROLLBACK');client.release();}
 });
 it('a durable SID receipt alone closes existing sessions after a receiver crash',async()=>{
  const f=await fixture();await pool.query(`INSERT INTO control.idempotency_record(actor_id,operation_type,key,canonical_body_hash,resource_id,result)
   VALUES($1,'identity.sid-revoked',$2,$3,$2,'{}')`,['00000000-0000-4000-8000-000000000030',nativeSidKey(origin+'/realms/dossiercle',f.sid),'a'.repeat(64)]);
  await expect(f.service.session(f.cookie)).rejects.toMatchObject({code:'UNAUTHENTICATED'});expect(f.counts().nativeChecks).toBe(0);
  await expect(f.issue()).rejects.toMatchObject({code:'UNAUTHENTICATED'});
 });
});
