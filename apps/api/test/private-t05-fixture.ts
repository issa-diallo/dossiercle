import { readFile } from 'node:fs/promises';
import { randomBytes,randomUUID } from 'node:crypto';
import { afterAll,beforeAll,expect } from 'vitest';
import { controlPool } from '@dossiercle/adapters/postgres/runtime-pool';
import { AuthorityJournal } from '@dossiercle/adapters/journal/authority-journal';
import { ControlRepository } from '@dossiercle/adapters/postgres/control.repository';
import { SessionCipher } from '@dossiercle/adapters/identity/session-cipher';
import { OwnerProofVerifier } from '@dossiercle/adapters/identity/owner-proof';
import { storeOwnerConfirmation } from '@dossiercle/adapters/identity/owner-confirmation';
import { NativeIdentityMismatch,type NativeUser } from '@dossiercle/adapters/identity/keycloak-adapter';
import { t05Hash } from '@dossiercle/adapters/postgres/t05.repository';
import { EnrollmentCoordinator } from '@dossiercle/adapters/identity/enrollment-coordinator';
import { AgenciesService } from '../src/agencies/agencies.service.js';
import { AuthService,SESSION_COOKIE } from '../src/auth/auth.service.js';
import { InvitationsService } from '../src/platform/invitations.service.js';
import type { T05CommandRequest } from '../src/platform/t05-context.js';

const env=JSON.parse(await readFile('.local/environment.json','utf8')) as {root:string;private:string;pgPort:number;tlsPort:number;syntheticOnly:boolean;ownerConfirmationKeyFingerprint:string};
if(!env.syntheticOnly||env.root!==process.cwd())throw new Error('SYNTHETIC_REQUIRED');
export const pool=controlPool({host:'127.0.0.1',port:env.pgPort,role:'control_coordinator',max:2,
  password:(await readFile(`${env.private}/pg/control_coordinator`,'utf8')).trim()});
export const observer=controlPool({host:'127.0.0.1',port:env.pgPort,role:'control_api',max:2,
  password:(await readFile(`${env.private}/pg/control_api`,'utf8')).trim()});
const privatePem=await readFile(`${env.private}/owner-signing/private.pem`);
const publicPem=await readFile(`${env.private}/owner-signing/public.pem`);
export const journal=new AuthorityJournal('.local/journal/tests-t05-invitations');
export const origin=`https://localhost:${env.tlsPort}`;
const observedClients=new WeakSet<object>();
beforeAll(()=>journal.initializeSynthetic());
afterAll(async()=>{privatePem.fill(0);await pool.end();await observer.end();});

// Real PostgreSQL/J1/Ed25519/BFF/service calls. Native user and refresh are explicit
// instrumented boundaries here; this suite does not qualify native browser MFA.
export async function fixture(){
  const owner=randomUUID(),ownerRoot=randomUUID(),users=new Map<string,NativeUser>();
  const refreshSubjects:string[]=[];
  const calls={refresh:0,user:0,create:0};let uncertain=true,authorizationChecks=0,interruptAt=0,transactions=0;
  let fault:{fragment:string;kind:'sql'|'connection'}|undefined;let crashSubject:string|undefined;
  const serviceJournal=new Proxy(journal,{get(target,key){
    if(key==='append')return async(...args:Parameters<AuthorityJournal['append']>)=>{const head=await target.append(...args);if(crashSubject===args[1].subjectId&&args[1].state==='PENDING'){crashSubject=undefined;throw new Error('SYNTHETIC_CRASH_AFTER_GRANT_FSYNC');}return head;};
    const value:unknown=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
  }});
  const servicePool=new Proxy(pool,{get(target,key){
    if(key==='connect')return async()=>{
      const client=await target.connect();if(!observedClients.has(client)){observedClients.add(client);client.on('error',()=>{});}
      return new Proxy(client,{get(connection,property){
        if(property==='query')return async(sql:string,params?:unknown[])=>{
          if(fault&&(fault.fragment==='SELECT 1'?sql===fault.fragment:sql.includes(fault.fragment)||params?.includes(fault.fragment))){
            const kind=fault.kind;fault=undefined;
            if(kind==='connection'){await connection.query('SELECT pg_terminate_backend(pg_backend_pid())');throw new Error('SYNTHETIC_SQL_CONNECTION_LOST');}
            return connection.query('SELECT 1/0');
          }
          return connection.query(sql,params);
        };
        const value:unknown=Reflect.get(connection,property);return typeof value==='function'?value.bind(connection):value;
      }});
    };
    const value:unknown=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
  }});
  const proof=new OwnerProofVerifier({publicPem,fingerprint:env.ownerConfirmationKeyFingerprint,ownerSubject:owner,syntheticOnly:true});
  const auth=new AuthService({pool:servicePool,control:new ControlRepository(servicePool,serviceJournal),journal:serviceJournal,cipher:new SessionCipher(randomBytes(32),randomBytes(32)),ownerSubject:owner,origin,
    nativeSession:async()=>{authorizationChecks++;},nativeRefresh:async(subject,payload)=>{calls.refresh++;refreshSubjects.push(subject);return payload;}});
  await observer.query("INSERT INTO control.agency_invitation(id,root_id,subject_id,contact,owner_id,identity_status,status) VALUES($1,$2,$3,$4,$3,'CONFIRMED','ISSUED')",[randomUUID(),ownerRoot,owner,owner+'@example.invalid']);
  const client=await pool.connect();let cookie:string;
  try{
    await client.query('BEGIN');await client.query('INSERT INTO identity.account_authority(subject_id) VALUES($1)',[owner]);
    const command=randomUUID();await journal.append(client,{subjectId:owner,commandId:command,epoch:1n,state:'PENDING'});
    const head=await journal.append(client,{subjectId:owner,commandId:command,epoch:1n,state:'CONFIRMED'});
    await client.query("UPDATE identity.account_authority SET status='CONFIRMED',confirmed_epoch=1,enrollment_status='VERIFIED',recovery_ready=true,journal_sequence=$2,journal_hash=$3 WHERE subject_id=$1",[owner,head.sequence.toString(),head.hash]);
    cookie=SESSION_COOKIE+'='+await auth.issue(client,{subjectId:owner,rootId:ownerRoot,scope:'platform',epoch:1n,nativePayload:{sid:randomUUID()}});
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  const view=await auth.session(cookie);
  const request=(version=1n,key=randomUUID()):T05CommandRequest=>({cookie,origin,csrf:view.csrfToken,key,version});
  const native={
    user:async(subject:string)=>{calls.user++;const user=users.get(subject);if(!user)throw new NativeIdentityMismatch();return user;},
    createUser:async(subject:string,username:string,contact:string,invitationRoot:string)=>{
      calls.create++;
      // The real service must have committed TXA and fsynced guest PENDING before import.
      expect((await observer.query('SELECT subject_id FROM control.agency_invitation WHERE root_id=$1',[invitationRoot])).rows[0]?.subject_id).toBe(subject);
      expect((await journal.head(subject))?.state).toBe('PENDING');
      const user={id:subject,username,contact,invitationRoot,enabled:true};users.set(subject,user);
      if(uncertain)throw new Error('SYNTHETIC_NATIVE_RESPONSE_LOST');return user;
    },
  };
  const privateAuth=new Proxy(auth,{get(target,key){
    if(key==='withT05Session')return async(...args:Parameters<AuthService['withT05Session']>)=>{
      if(interruptAt&&++transactions===interruptAt){interruptAt=0;throw new Error('SYNTHETIC_BETWEEN_TRANSACTIONS');}
      return target.withT05Session(...args);
    };
    const value:unknown=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
  }});
  const service=new InvitationsService({auth:privateAuth,proof,journal:serviceJournal,origin,native});
  const confirmation=async()=>{
    const email=randomUUID()+'@example.invalid',c=await pool.connect();let signed;
    try{
      await c.query('BEGIN');signed=await storeOwnerConfirmation(c,{ownerSubject:owner,fingerprint:env.ownerConfirmationKeyFingerprint,privatePem,email,provenance:'synthetic-fixture'},proof);
      await c.query('COMMIT');
    }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
    return {signed,refs:{email,identityConfirmationRef:signed.identityConfirmationRef,recoveryChannelRef:signed.recoveryChannelRef}};
  };
  const pending=async()=>{
    const {signed,refs}=await confirmation();
    const result=await service.create(request(),refs);
    expect(result).toEqual({invitationId:signed.invitationId,status:'PENDING_IDENTITY'});
    return signed;
  };
  const snapshot=async(subject:string)=>({
    owner:await journal.head(owner),guest:await journal.head(subject),calls:{...calls},
    sessions:(await pool.query('SELECT * FROM identity.session WHERE subject_id=$1',[owner])).rows,
  });
  const agencies=new AgenciesService({auth});
  const enroll=async(issued:{enrollmentUrl?:string})=>{
    if(!issued.enrollmentUrl)throw new Error('SYNTHETIC_LINK_MISSING');
    const token=new URLSearchParams(new URL(issued.enrollmentUrl).hash.slice(1)).get('token')!;
    const enrollment=new EnrollmentCoordinator({pool:servicePool,journal,origin});const admitted=await enrollment.admit(token),sid=randomUUID();
    const guestCookie=SESSION_COOKIE+'='+await enrollment.confirm(admitted.cookie,async grant=>({subject:grant.subject,sid,
      passwordConfigured:true,recoveryReady:true,enrollmentVerified:true,nativePayload:{sid}}),async(client,grant,nativePayload)=>
      auth.issue(client,{subjectId:grant.subject,rootId:grant.root,scope:'onboarding',epoch:grant.epoch,nativePayload,
        receipt:{version:grant.version,tokenHash:grant.tokenHash!,admissionReceipt:grant.admissionReceipt!}}));
    const session=await auth.session(guestCookie);
    return {cookie:guestCookie,token,subject:admitted.grant.subject,root:admitted.grant.root,
      request:(key=randomUUID()):T05CommandRequest=>({cookie:guestCookie,origin,csrf:session.csrfToken,key})};
  };
  const legacy=async(subject:string,root:string,withReceipt=false)=>{
    const c=await pool.connect();let value:string;
    try{await c.query('BEGIN');await c.query('SELECT root_id FROM control.agency_invitation WHERE root_id=$1 FOR SHARE',[root]);
      const authority=(await c.query('SELECT * FROM identity.account_authority WHERE subject_id=$1 FOR UPDATE',[subject])).rows[0];
      const original=withReceipt?(await c.query("SELECT result FROM control.idempotency_record WHERE actor_id=$1 AND operation_type='identity.onboarding-receipt.v1' ORDER BY key LIMIT 1",[subject])).rows[0]?.result:undefined;
      value=await auth.issue(c,{subjectId:subject,rootId:root,scope:'onboarding',epoch:BigInt(authority.identity_epoch),nativePayload:{sid:randomUUID()},...(original?{receipt:{version:original.version,tokenHash:original.tokenHash,admissionReceipt:original.admissionReceipt}}:{})});await c.query('COMMIT');
    }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
    const cookie=SESSION_COOKIE+'='+value,session=await auth.session(cookie);
    return {cookie,hash:t05Hash(value),request:()=>({cookie,origin,csrf:session.csrfToken,key:randomUUID()})};
  };
  return {owner,service,agencies,enroll,legacy,confirmation,auth,cookie,calls,refreshSubjects,request,pending,snapshot,healthy:()=>{uncertain=false;},authorizationChecks:()=>authorizationChecks,interruptNextExecution:()=>{interruptAt=3;transactions=0;},interruptBeforePreparation:()=>{interruptAt=2;transactions=0;},crashAfterPending:(subject:string)=>{crashSubject=subject;},failSql:(fragment:string,kind:'sql'|'connection'='sql')=>{fault={fragment,kind};}};
}
