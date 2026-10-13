import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import https from 'node:https';
import { nativeTransport } from '../src/identity/native-transport.js';
import { readFile } from 'node:fs/promises';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { AuthorityJournal } from '../src/journal/authority-journal.js';
import { EnrollmentCoordinator } from '../src/identity/enrollment-coordinator.js';
const env=JSON.parse(await readFile('.local/environment.json','utf8')) as {private:string;pgPort:number;syntheticOnly:boolean};
if(!env.syntheticOnly)throw new Error('SYNTHETIC_REQUIRED');
const qualificationName='s01-grant-'+randomUUID();
const config={application_name:qualificationName,host:'127.0.0.1',port:env.pgPort,database:'control',max:3};
const coordinatorPool=new Pool({...config,user:'control_coordinator',password:(await readFile(env.private+'/pg/control_coordinator','utf8')).trim()});
const api=new Pool({...config,user:'control_api',password:(await readFile(env.private+'/pg/control_api','utf8')).trim()});
const journal=new AuthorityJournal('.local/journal/tests-enrollment');
const origin='https://localhost:'+JSON.parse(await readFile('.local/environment.json','utf8')).tlsPort;
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
beforeAll(()=>journal.initializeSynthetic());afterAll(async()=>{await coordinatorPool.end();await api.end();});
async function fixture(){
 const subject=randomUUID(),root=randomUUID(),token=randomBytes(32).toString('base64url');
 const c=await coordinatorPool.connect();
 try {await c.query('BEGIN');await c.query('INSERT INTO identity.account_authority(subject_id) VALUES($1)',[subject]);
  const head=await journal.append(c,{subjectId:subject,commandId:randomUUID(),epoch:1n,state:'PENDING'});
  await c.query('UPDATE identity.account_authority SET journal_sequence=$2,journal_hash=$3 WHERE subject_id=$1',[subject,head.sequence.toString(),head.hash]);await c.query('COMMIT');
 }finally{c.release();}
 await api.query(`INSERT INTO control.agency_invitation(id,root_id,subject_id,contact,owner_id,identity_status,token_hash,expires_at,status)
  VALUES($1,$2,$3,$4,$5,'CONFIRMED',$6,now()+interval '10 minutes','ISSUED')`,[randomUUID(),root,subject,subject+'@example.invalid',randomUUID(),sha(token)]);
 return {subject,root,token};
}
const service=()=>new EnrollmentCoordinator({pool:coordinatorPool,journal,origin});
describe('temporary native enrollment barrier; storage fixtures do not prove MFA',()=>{
 it('consumes admission once durably and closes old grant after restart',async()=>{
  const f=await fixture(),s=service(),admission=await s.admit(f.token);
  expect(admission.grant.root).toBe(f.root);expect(admission.grant.epoch).toBe(1n);
  await expect(s.admit(f.token)).rejects.toThrow('INVITATION_UNAVAILABLE');
  const restarted=service();await expect(restarted.admit(f.token)).rejects.toThrow('INVITATION_UNAVAILABLE');
  await expect(restarted.withGrant(admission.cookie,{mutation:false},async()=>({value:true}))).rejects.toThrow('INVITATION_UNAVAILABLE');
 });
 it('binds native JWT to current grant and exact origin, never another grant',async()=>{
  const a=await fixture(),b=await fixture(),s=service();const ga=await s.admit(a.token),gb=await s.admit(b.token);
  const jwt=randomBytes(32).toString('base64url');
  await s.withGrant(ga.cookie,{mutation:true,origin,mintJwt:true},async()=>({value:true,mintedJwt:jwt}));
  await expect(s.withGrant(gb.cookie,{mutation:true,origin,nativeJwt:jwt},async()=>({value:true}))).rejects.toThrow('INVITATION_UNAVAILABLE');
  await expect(s.withGrant(ga.cookie,{mutation:true,origin:'https://example.invalid',nativeJwt:jwt},async()=>({value:true}))).rejects.toThrow('INVITATION_UNAVAILABLE');
  await expect(s.withGrant(ga.cookie,{mutation:true,origin},async()=>({value:true}))).rejects.toThrow('INVITATION_UNAVAILABLE');
  expect(await s.withGrant(ga.cookie,{mutation:true,origin,nativeJwt:jwt},async()=>({value:true}))).toBe(true);
 });
 it('holds authority lock throughout mutation; concurrent deny waits and closes later requests',async()=>{
  const f=await fixture(),s=service(),g=await s.admit(f.token),jwt=randomBytes(32).toString('base64url');
  await s.withGrant(g.cookie,{mutation:true,origin,mintJwt:true},async()=>({value:true,mintedJwt:jwt}));
  let release!:()=>void,entered!:()=>void;const ready=new Promise<void>(r=>{entered=r;}),wait=new Promise<void>(r=>{release=r;});
  const mutation=s.withGrant(g.cookie,{mutation:true,origin,nativeJwt:jwt},async()=>{entered();await wait;return {value:true};});await ready;
  let denied=false;const deny=(async()=>{const c=await coordinatorPool.connect();try{await c.query('BEGIN');await c.query('SELECT * FROM identity.account_authority WHERE subject_id=$1 FOR UPDATE',[f.subject]);denied=true;
    const head=await journal.append(c,{subjectId:f.subject,commandId:randomUUID(),epoch:2n,state:'DENIED'});await c.query("UPDATE identity.account_authority SET status='DENIED',identity_epoch=2,journal_sequence=$2,journal_hash=$3 WHERE subject_id=$1",[f.subject,head.sequence.toString(),head.hash]);await c.query('COMMIT');}finally{c.release();}})();
  await api.query('SELECT pg_sleep(0.05)');expect(denied).toBe(false);release();expect(await mutation).toBe(true);await deny;
  await expect(s.withGrant(g.cookie,{mutation:false},async()=>({value:true}))).rejects.toThrow('INVITATION_UNAVAILABLE');
 });
 it('native failure after J1 append leaves durable divergence and forbids blind retry',async()=>{
  const f=await fixture(),s=service(),g=await s.admit(f.token),jwt=randomBytes(32).toString('base64url');
  await s.withGrant(g.cookie,{mutation:true,origin,mintJwt:true},async()=>({value:true,mintedJwt:jwt}));
  await expect(s.withGrant(g.cookie,{mutation:true,origin,nativeJwt:jwt},async()=>{throw new Error('SYNTHETIC_AFTER_NATIVE_EFFECT');})).rejects.toThrow('SYNTHETIC_AFTER_NATIVE_EFFECT');
  await expect(s.withGrant(g.cookie,{mutation:true,origin,nativeJwt:jwt},async()=>({value:true}))).rejects.toThrow('INVITATION_UNAVAILABLE');
 });
 it('aborts the native request on actual PG connection loss and starts no later effect',async()=>{
  const f=await fixture(),s=service(),g=await s.admit(f.token),jwt=randomBytes(32).toString('base64url');
  await s.withGrant(g.cookie,{mutation:true,origin,mintJwt:true},async()=>({value:true,mintedJwt:jwt}));
  const killer=new Pool({...config,database:'postgres',user:'synthetic_bootstrap',password:(await readFile(env.private+'/pg/bootstrap','utf8')).trim(),max:1});
  let entered!:()=>void;const ready=new Promise<void>(r=>{entered=r;});
  const peer=https.createServer({key:await readFile(env.private+'/coordinator/server.key'),cert:await readFile(env.private+'/coordinator/server.crt')},()=>{entered();});
  await new Promise<void>(r=>peer.listen(0,'127.0.0.1',r));const address=peer.address();if(!address||typeof address==='string')throw new Error('SYNTHETIC_PEER_UNAVAILABLE');
  const native=nativeTransport({advertisedOrigin:'https://identity-coordinator:'+address.port,host:'127.0.0.1',port:address.port,serverName:'identity-coordinator',caFile:env.private+'/ca/ca.crt'});
  let laterEffect=false;
  const mutation=s.withGrant(g.cookie,{mutation:true,origin,nativeJwt:jwt},async(_grant,lease)=>{
   await lease.check();await native('https://identity-coordinator:'+address.port+'/effect',{signal:lease.signal});await lease.check();laterEffect=true;return {value:true};
  });
  const refusal=expect(mutation).rejects.toThrow();
  try{
   await ready;const backend=(await killer.query("SELECT pid FROM pg_stat_activity WHERE application_name=$1 AND usename='control_coordinator' AND state='idle in transaction'",[qualificationName])).rows;
   expect(backend.length).toBe(1);await killer.query('SELECT pg_terminate_backend($1)',[backend[0].pid]);await refusal;
   expect(laterEffect).toBe(false);await expect(s.withGrant(g.cookie,{mutation:false},async()=>({value:true}))).rejects.toThrow('INVITATION_UNAVAILABLE');
  }finally{peer.closeAllConnections();await new Promise<void>(r=>peer.close(()=>r()));await killer.end();}
 });
 it('never confirms incomplete or foreign native evidence and never issues a BFF cookie',async()=>{
  for(const mismatch of ['password','subject']){
   const f=await fixture(),s=service(),g=await s.admit(f.token);let issued=false;
   await expect(s.confirm(g.cookie,async()=>({subject:mismatch==='subject'?randomUUID():f.subject,sid:randomUUID(),passwordConfigured:mismatch!=='password',recoveryReady:true,enrollmentVerified:true,nativePayload:{}}),async()=>{issued=true;})).rejects.toThrow('INVITATION_UNAVAILABLE');
   expect(issued).toBe(false);expect((await coordinatorPool.query('SELECT status,enrollment_status FROM identity.account_authority WHERE subject_id=$1',[f.subject])).rows[0]).toEqual({status:'PENDING',enrollment_status:'PENDING'});
   await expect(s.withGrant(g.cookie,{mutation:false},async()=>({value:true}))).rejects.toThrow('INVITATION_UNAVAILABLE');
  }
 });
 it('expires absolutely and closes reissued invitation versions',async()=>{
  const f=await fixture();let now=Date.now();const s=new EnrollmentCoordinator({pool:coordinatorPool,journal,origin,now:()=>now});const g=await s.admit(f.token);
  now=g.grant.expires;await expect(s.withGrant(g.cookie,{mutation:false},async()=>({value:true}))).rejects.toThrow('INVITATION_UNAVAILABLE');
  const other=await fixture(),fresh=service(),grant=await fresh.admit(other.token);await api.query('UPDATE control.agency_invitation SET version=version+1 WHERE root_id=$1',[other.root]);
  await expect(fresh.withGrant(grant.cookie,{mutation:false},async()=>({value:true}))).rejects.toThrow('INVITATION_UNAVAILABLE');
 });
 it('refuses publication when the grant expires during a native mutation',async()=>{
  const f=await fixture();let now=Date.now();
  const s=new EnrollmentCoordinator({pool:coordinatorPool,journal,origin,now:()=>now}),g=await s.admit(f.token);
  const jwt=randomBytes(32).toString('base64url');
  await s.withGrant(g.cookie,{mutation:true,origin,mintJwt:true},async()=>({value:true,mintedJwt:jwt}));
  let entered!:()=>void,release!:()=>void;
  const ready=new Promise<void>(r=>{entered=r;}),pending=new Promise<void>(r=>{release=r;});
  const mutation=s.withGrant(g.cookie,{mutation:true,origin,nativeJwt:jwt},async(_grant,lease)=>{
   await lease.check();entered();await pending;return {value:true};
  });
  const refusal=expect(mutation).rejects.toThrow('INVITATION_UNAVAILABLE');
  await ready;now=g.grant.expires;release();await refusal;
  const authority=(await coordinatorPool.query('SELECT journal_sequence,journal_hash,status FROM identity.account_authority WHERE subject_id=$1',[f.subject])).rows[0];
  const head=await journal.head(f.subject);
  expect(authority.status).toBe('PENDING');expect(head?.sequence).not.toBe(BigInt(authority.journal_sequence));
  await expect(s.withGrant(g.cookie,{mutation:false},async()=>({value:true}))).rejects.toThrow('INVITATION_UNAVAILABLE');
 });
});
