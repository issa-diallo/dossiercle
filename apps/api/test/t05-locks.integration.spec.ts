import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { controlPool } from '@dossiercle/adapters/postgres/runtime-pool';
import { AuthorityJournal } from '@dossiercle/adapters/journal/authority-journal';
import { ControlRepository } from '@dossiercle/adapters/postgres/control.repository';
import { SessionCipher } from '@dossiercle/adapters/identity/session-cipher';
import { writeAudit } from '@dossiercle/adapters/audit/audit-writer';
import { AuthService, NativeIdentityChanged, SESSION_COOKIE } from '../src/auth/auth.service.js';
import type { T05LockPlan, T05Target } from '../src/auth/t05-locks.js';

const env=JSON.parse(await readFile('.local/environment.json','utf8')) as {root:string;private:string;pgPort:number;tlsPort:number;syntheticOnly:boolean};
if(!env.syntheticOnly||env.root!==process.cwd())throw new Error('SYNTHETIC_REQUIRED');
const raw=controlPool({host:'127.0.0.1',port:env.pgPort,role:'control_coordinator',max:2,
  password:(await readFile(`${env.private}/pg/control_coordinator`,'utf8')).trim()});
const observer=controlPool({host:'127.0.0.1',port:env.pgPort,role:'control_api',max:2,
  password:(await readFile(`${env.private}/pg/control_api`,'utf8')).trim()});
const trace:{sql:string;params:unknown[]|undefined}[]=[];
const pool=new Proxy(raw,{get(target,key){
  if(key==='connect')return async()=>{
    const client=await target.connect();
    return new Proxy(client,{get(connection,property){
      if(property==='query')return (sql:string,params?:unknown[])=>{trace.push({sql,params});return connection.query(sql,params);};
      const value:unknown=Reflect.get(connection,property);return typeof value==='function'?value.bind(connection):value;
    }});
  };
  const value:unknown=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
}});
const journal=new AuthorityJournal('.local/journal/tests-t05-locks');
const cipher=new SessionCipher(randomBytes(32),randomBytes(32));
const origin=`https://localhost:${env.tlsPort}`;
beforeAll(()=>journal.initializeSynthetic());
afterAll(async()=>{await raw.end();await observer.end();});
const uuid=(prefix:string)=>prefix+randomUUID().slice(1);
function latch(){let release!:()=>void;const promise=new Promise<void>(resolve=>{release=resolve;});return {promise,release};}

// Real SQL/J1/session fixtures; native adapters are explicit boundaries, not native MFA evidence.
async function fixture(options:{higher?:boolean;pendingTarget?:boolean;refreshFails?:boolean;journalFails?:boolean}={}){
  const owner=uuid(options.higher?'f':'0'),guest=uuid(options.higher?'0':'f');
  const ownerRoot=uuid(options.higher?'f':'0'),guestRoot=uuid(options.higher?'0':'f');
  let changed=false;
  const effectiveJournal=options.journalFails?new Proxy(journal,{get(target,key){
    if(key==='append')return async()=>{throw new Error('SYNTHETIC_J1_UNAVAILABLE');};
    const value:unknown=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
  }}):journal;
  const service=new AuthService({pool,control:new ControlRepository(pool,journal),journal:effectiveJournal,cipher,ownerSubject:owner,origin,
    nativeSession:async(subject)=>{if(changed&&subject===owner)throw new NativeIdentityChanged();},
    nativeRefresh:async(_subject,payload)=>{if(options.refreshFails)throw new Error('SYNTHETIC_REFRESH_FAILURE');return payload;}});
  const make=async(subject:string,root:string,scope:'platform'|'onboarding')=>{
    const client=await pool.connect();
    try{
      await client.query('BEGIN');await client.query('INSERT INTO identity.account_authority(subject_id) VALUES($1)',[subject]);
      const command=randomUUID();await journal.append(client,{subjectId:subject,commandId:command,epoch:1n,state:'PENDING'});
      const head=await journal.append(client,{subjectId:subject,commandId:command,epoch:1n,state:'CONFIRMED'});
      await client.query(`UPDATE identity.account_authority SET status='CONFIRMED',confirmed_epoch=1,enrollment_status='VERIFIED',recovery_ready=true,journal_sequence=$2,journal_hash=$3 WHERE subject_id=$1`,[subject,head.sequence.toString(),head.hash]);
      await client.query('COMMIT');
    }finally{client.release();}
    await observer.query(`INSERT INTO control.agency_invitation(id,root_id,subject_id,contact,owner_id,identity_status,status,expires_at)
      VALUES($1,$2,$3,$4,$5,'CONFIRMED','ISSUED',now()+interval '1day')`,[randomUUID(),root,subject,subject+'@example.invalid',owner]);
    const c=await pool.connect();try{
      await c.query('BEGIN');await c.query('SELECT root_id FROM control.agency_invitation WHERE root_id=$1 FOR SHARE',[root]);
      const cookie=await service.issue(c,{subjectId:subject,rootId:root,scope,epoch:1n,nativePayload:{sid:randomUUID()}});
      await c.query('COMMIT');return SESSION_COOKIE+'='+cookie;
    }finally{c.release();}
  };
  const ownerCookie=await make(owner,ownerRoot,'platform');
  let guestCookie:string|undefined;
  if(!options.pendingTarget)guestCookie=await make(guest,guestRoot,'onboarding');
  else await observer.query(`INSERT INTO control.agency_invitation(id,root_id,subject_id,contact,owner_id)
    VALUES($1,$2,$3,$4,$5)`,[randomUUID(),guestRoot,guest,guest+'@example.invalid',owner]);
  const ownerView=await service.session(ownerCookie);
  const target:T05Target={rootId:guestRoot,subjectId:guest,authority:options.pendingTarget?'initialize-pending':'existing',invitation:'existing'};
  const plan:T05LockPlan={mode:'owner',resolve:async()=>[target]};
  return {owner,guest,ownerRoot,guestRoot,service,ownerCookie,guestCookie,target,plan,
    mutation:{origin,csrf:ownerView.csrfToken,humanActivity:true as const},setChanged:()=>{changed=true;}};
}

describe('T05 prelocks before J1, real PostgreSQL concurrency and T04 continuity',()=>{
  it.each([false,true])('orders owner/target above and below without requiring PENDING target confirmation higher=%s',async higher=>{
    const f=await fixture({higher,pendingTarget:true});trace.length=0;
    await f.service.withT05Session(f.ownerCookie,f.mutation,f.plan,async(client,principal,locked)=>{
      expect(principal.subjectId).toBe(f.owner);expect(locked.authorities.get(f.guest)?.status).toBe('PENDING');
      expect(await journal.head(f.guest)).toBeNull();
      expect((await client.query('SELECT current_user')).rows[0].current_user).toBe('control_t05');
    });
    const rootLocks=trace.filter(entry=>entry.sql==='SELECT * FROM control.agency_invitation WHERE root_id=$1 FOR UPDATE').map(entry=>entry.params?.[0]);
    expect(rootLocks).toEqual([f.ownerRoot,f.guestRoot].sort());
    const authorityLocks=trace.filter(entry=>entry.sql==='SELECT * FROM identity.account_authority WHERE subject_id=$1 FOR UPDATE').map(entry=>entry.params?.[0]);
    expect(authorityLocks).toEqual([f.owner,f.guest].sort());
    const firstJ1=trace.findIndex(entry=>entry.sql.includes("hashtextextended('s01.journal.writer'"));expect(firstJ1).toBeGreaterThan(0);
    expect(trace.slice(firstJ1).some(entry=>/FOR (UPDATE|SHARE)|control\.lock_authority|control\.lock_session_scope/.test(entry.sql))).toBe(false);
  });
  it('revalidates a changed server plan before refresh/J1 and refuses foreign onboarding targets',async()=>{
    const f=await fixture();let calls=0;const before=await journal.head(f.owner);
    await expect(f.service.withT05Session(f.ownerCookie,f.mutation,{mode:'owner',resolve:async()=>[{...f.target,subjectId:++calls===1?f.guest:randomUUID()}]},async()=>{})).rejects.toThrow('INVITATION_UNAVAILABLE');
    expect(await journal.head(f.owner)).toEqual(before);
    const view=await f.service.session(f.guestCookie);
    await expect(f.service.withT05Session(f.guestCookie,{origin,csrf:view.csrfToken,humanActivity:true},
      {mode:'onboarding',resolve:async()=>[{...f.target,rootId:f.ownerRoot,subjectId:f.owner}]},async()=>{})).rejects.toThrow('FORBIDDEN');
  });
  it('uses the existing scope definer for a PROVISIONING projection without widening agency UPDATE',async()=>{
    const f=await fixture(),agency=randomUUID();
    await observer.query("INSERT INTO control.agency(id,invitation_root_id,name,canonical_name_hash) VALUES($1,$2,'Synthetic lock fixture',$3)",[agency,f.guestRoot,'a'.repeat(64)]);
    await observer.query("INSERT INTO identity.membership(subject_id,agency_id,role) VALUES($1,$2,'ADMIN')",[f.guest,agency]);
    trace.length=0;
    await f.service.withT05Session(f.ownerCookie,f.mutation,f.plan,async()=>{});
    const memberLock=trace.findIndex(entry=>entry.sql.startsWith('SELECT subject_id,agency_id FROM identity.membership'));
    const scopeLock=trace.findIndex(entry=>entry.sql==='SELECT * FROM control.lock_session_scope($1,$2)');
    expect(memberLock).toBeGreaterThan(0);expect(scopeLock).toBeGreaterThan(memberLock);
    const view=await f.service.session(f.guestCookie);
    await f.service.withT05Session(f.guestCookie,{origin,csrf:view.csrfToken,humanActivity:true},
      {mode:'onboarding',resolve:async()=>[f.target]},async(_client,_principal,locked)=>{
        expect(locked.authorities.get(f.guest)?.journal_hash).toBe((await journal.head(f.guest))?.hash);
      });
  });
  it('rechecks a session candidate changed by a second connection before acquiring its authority',async()=>{
    const f=await fixture(),entered=latch(),release=latch();const before=await journal.head(f.owner);
    const pending=f.service.withT05Session(f.ownerCookie,f.mutation,{mode:'owner',resolve:async()=>{entered.release();await release.promise;return [f.target];}},async()=>{});
    await entered.promise;
    await observer.query("UPDATE identity.session SET scope='onboarding' WHERE subject_id=$1",[f.owner]);
    release.release();await expect(pending).rejects.toThrow('UNAUTHENTICATED');
    expect(await journal.head(f.owner)).toEqual(before);
  });
  it.each(['VERSION_CONFLICT','IDEMPOTENCY_CONFLICT','CREATION_CONFLICT'])('refuses normal %s before refresh without session/J1 drift, then retries with the same session',async code=>{
    const f=await fixture();
    const beforeHead=await journal.head(f.owner);
    const beforeSession=(await raw.query('SELECT * FROM identity.session WHERE subject_id=$1',[f.owner])).rows;
    let work=0;trace.length=0;
    await expect(f.service.withT05Session(f.ownerCookie,f.mutation,{...f.plan,validate:async()=>{throw new Error(code);}},async()=>{work++;})).rejects.toThrow(code);
    expect(work).toBe(0);expect(await journal.head(f.owner)).toEqual(beforeHead);
    expect((await raw.query('SELECT * FROM identity.session WHERE subject_id=$1',[f.owner])).rows).toEqual(beforeSession);
    expect(trace.some(entry=>entry.sql.includes("hashtextextended('s01.journal.writer'"))).toBe(false);
    const decision=Object.freeze({kind:'replay' as const,value:randomUUID()});let validated=false;
    await f.service.withT05Session(f.ownerCookie,f.mutation,{...f.plan,validate:async(client,principal,locked)=>{
      validated=true;expect(await journal.head(f.owner)).toEqual(beforeHead);
      expect((await client.query('SELECT current_user')).rows[0].current_user).toBe('control_coordinator');
      expect(principal.subjectId).toBe(f.owner);expect(locked.targets).toEqual([f.target]);return decision;
    }},async(_client,_principal,_locked,actual)=>{
      work++;expect(validated).toBe(true);expect(actual).toBe(decision);expect(Object.isFrozen(actual)).toBe(true);
      const after=await journal.head(f.owner);expect(after?.state).toBe('CONFIRMED');
      expect(after?.epoch).toBe(beforeHead?.epoch);expect(after?.commandId).not.toBe(beforeHead?.commandId);
      expect(after!.sequence).toBeGreaterThan(beforeHead!.sequence);
    });
    expect(work).toBe(1);expect((await f.service.session(f.ownerCookie)).scope).toBe('platform');
  });
  it('does not run business validation or refresh on invalid CSRF',async()=>{
    const f=await fixture();let validation=0,work=0;const before=await journal.head(f.owner);
    await expect(f.service.withT05Session(f.ownerCookie,{...f.mutation,csrf:'A'.repeat(43)},
      {...f.plan,validate:async()=>{validation++;}},async()=>{work++;})).rejects.toThrow('FORBIDDEN');
    expect(validation).toBe(0);expect(work).toBe(0);expect(await journal.head(f.owner)).toEqual(before);
  });
  it('commits native DENIED before refusal and never enters the T05 callback',async()=>{
    const f=await fixture();f.setChanged();let work=0,validation=0;
    await expect(f.service.withT05Session(f.ownerCookie,f.mutation,{...f.plan,validate:async()=>{validation++;}},async()=>{work++;})).rejects.toThrow('UNAUTHENTICATED');
    expect(validation).toBe(0);expect(work).toBe(0);expect((await journal.head(f.owner))?.state).toBe('DENIED');
    const row=(await raw.query('SELECT status,identity_epoch FROM identity.account_authority WHERE subject_id=$1',[f.owner])).rows[0];
    expect(row).toEqual({status:'DENIED',identity_epoch:'2'});
    expect((await raw.query('SELECT count(*)::int AS n FROM identity.session WHERE subject_id=$1 AND revoked_at IS NULL',[f.owner])).rows[0].n).toBe(0);
  });
  it('keeps failed-refresh J1 PENDING and refuses the rolled-back SQL authorization',async()=>{
    const f=await fixture({refreshFails:true});let work=0;
    await expect(f.service.withT05Session(f.ownerCookie,f.mutation,f.plan,async()=>{work++;})).rejects.toThrow('SYNTHETIC_REFRESH_FAILURE');
    expect(work).toBe(0);expect((await journal.head(f.owner))?.state).toBe('PENDING');
    await expect(f.service.session(f.ownerCookie)).rejects.toThrow();
  });
  it('closes before any native refresh or business callback when the J1 writer fails',async()=>{
    const f=await fixture({journalFails:true});let work=0;const before=await journal.head(f.owner);
    await expect(f.service.withT05Session(f.ownerCookie,f.mutation,f.plan,async()=>{work++;})).rejects.toThrow('SYNTHETIC_J1_UNAVAILABLE');
    expect(work).toBe(0);expect(await journal.head(f.owner)).toEqual(before);
  });
  it('does not cycle with the existing authority-first deny path',async()=>{
    const f=await fixture(),entered=latch(),release=latch();
    const deny=new ControlRepository(pool,journal).deny(f.guest,randomUUID(),async()=>{entered.release();await release.promise;});
    await Promise.race([entered.promise,deny]);let pid=0;
    const owner=f.service.withT05Session(f.ownerCookie,f.mutation,{mode:'owner',resolve:async client=>{
      pid=(await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid as number;return [f.target];}},async(_client,_principal,locked)=>{
        expect(locked.authorities.get(f.guest)?.status).toBe('DENIED');
      });
    void owner.catch(()=>{});
    try {
      await expect.poll(async()=>pid>0?(await observer.query('SELECT count(*)::int AS n FROM pg_locks WHERE pid=$1 AND NOT granted',[pid])).rows[0].n:0,{timeout:1500,interval:10}).toBeGreaterThan(0);
    } finally {release.release();await Promise.allSettled([deny,owner]);}
    await Promise.all([deny,owner]);expect((await journal.head(f.guest))?.state).toBe('DENIED');
  });
  it('rolls back business work on audit failure after refresh, leaving J1 opposable',async()=>{
    const f=await fixture(),eventId=randomUUID();
    await expect(f.service.withT05Session(f.ownerCookie,f.mutation,f.plan,async client=>{
      const intent={eventId,agencyId:null,actorId:f.owner,actorType:'human' as const,eventType:'synthetic.t05.lock-audit',resourceId:f.guestRoot,
        version:1n,outcome:'accepted' as const,correlation:randomUUID(),dispatch:true};
      await writeAudit(client,intent,'control_audit');await writeAudit(client,intent,'control_audit');
    })).rejects.toMatchObject({code:'23505'});
    expect((await raw.query('SELECT 1 FROM control.audit_event WHERE event_id=$1',[eventId])).rowCount).toBe(0);
    await expect(f.service.session(f.ownerCookie)).rejects.toThrow();
  });
  for(const finalStatus of ['REVOKED','ISSUED'] as const)it(`serializes a modeled claim against owner ${finalStatus} and closes old T04 sessions`,async()=>{
    const f=await fixture(),entered=latch(),release=latch();const view=await f.service.session(f.guestCookie);
    const claim=f.service.withT05Session(f.guestCookie,{origin,csrf:view.csrfToken,humanActivity:true},
      {mode:'onboarding',resolve:async()=>[f.target]},async client=>{entered.release();await release.promise;
        await client.query("UPDATE control.agency_invitation SET status='CLAIMED' WHERE root_id=$1",[f.guestRoot]);});
    await Promise.race([entered.promise,claim]);let pid=0;
    const owner=f.service.withT05Session(f.ownerCookie,f.mutation,{mode:'owner',resolve:async client=>{
      pid=(await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid as number;return [f.target];}},async(client,_principal,locked)=>{
      const epoch=BigInt(locked.authorities.get(f.guest)!.identity_epoch)+1n;
      await client.query('SET LOCAL ROLE control_coordinator');
      const head=await journal.append(client,{subjectId:f.guest,commandId:randomUUID(),epoch,state:'PENDING',actor:{id:f.owner,type:'human'}});
      await client.query(`UPDATE identity.account_authority SET status='PENDING',identity_epoch=$2,confirmed_epoch=NULL,enrollment_status='PENDING',recovery_ready=false,journal_sequence=$3,journal_hash=$4 WHERE subject_id=$1`,[f.guest,epoch.toString(),head.sequence.toString(),head.hash]);
      await client.query('UPDATE identity.session SET revoked_at=now() WHERE subject_id=$1',[f.guest]);
      await client.query('SET LOCAL ROLE control_t05');
      await client.query('UPDATE control.agency_invitation SET status=$2,version=version+1,token_hash=NULL WHERE root_id=$1',[f.guestRoot,finalStatus]);
    });
    void owner.catch(()=>{});
    try {
      await expect.poll(async()=>pid>0?(await observer.query('SELECT count(*)::int AS n FROM pg_locks WHERE pid=$1 AND NOT granted',[pid])).rows[0].n:0,{timeout:1500,interval:10}).toBeGreaterThan(0);
    } finally {release.release();await Promise.allSettled([claim,owner]);}
    await Promise.all([claim,owner]);
    expect((await journal.head(f.guest))?.state).toBe('PENDING');
    await expect(f.service.session(f.guestCookie)).rejects.toThrow();
    expect((await raw.query('SELECT status FROM control.agency_invitation WHERE root_id=$1',[f.guestRoot])).rows[0].status).toBe(finalStatus);
  });
});
