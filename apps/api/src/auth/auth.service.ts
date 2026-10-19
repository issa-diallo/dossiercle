import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Pool, PoolClient } from '@dossiercle/adapters/postgres/runtime-pool';
import type { ControlRepository } from '@dossiercle/adapters/postgres/control.repository';
import type { SessionCipher } from '@dossiercle/adapters/identity/session-cipher';
import type { Session, ApiErrorCode } from '@dossiercle/contracts';
import type { AuthorityProjection } from '@dossiercle/domain/authority';
import type { AuthorityJournal } from '@dossiercle/adapters/journal/authority-journal';
import { nativeSid, nativeSidKey } from '@dossiercle/adapters/identity/native-sid';
import { writeAudit } from '@dossiercle/adapters/audit/audit-writer';
import { writeOnboardingReceipt,checkAdmission,type AdmissionContext } from '@dossiercle/adapters/identity/onboarding-receipt';
import { lockT05Subjects, type T05LockPlan, type T05LockedContext, type T05AuthorityRow } from './t05-locks.js';
export class AuthClosed extends Error {
  constructor(readonly code: ApiErrorCode) { super(code); }
}
/** A positively observed native factor or identity change, never a transport failure. */
export class NativeIdentityChanged extends Error {
  constructor() { super('NATIVE_IDENTITY_CHANGED'); }
}
export class NativeSessionEnded extends Error {
  constructor() { super('NATIVE_SESSION_ENDED'); }
}
export interface SessionRow {
  cookie_hash:string;subject_id:string;scope:string;invitation_root_id:string|null;agency_id:string|null;
  epoch:string;issued_at:Date;last_human_activity_at:Date;absolute_expires_at:Date;revoked_at:Date|null;encrypted_oidc_tokens:string;
}
export interface SessionPrincipal { subjectId:string;rootId:string|null;scope:Session['scope'];agencyId:string|null;epoch:bigint;cookieHash:string;issuedAt:string;view:Session }
export interface BootstrapActor {subject:string;root:string;epoch:bigint;scope:'platform'|'onboarding';version:string;tokenHash?:string;admissionReceipt?:string}
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export const SESSION_COOKIE='__Host-dossiercle';
export function opaqueCookie(header:string|undefined,name=SESSION_COOKIE):string {
  const values=(header??'').split(';').map(value=>value.trim()).filter(value=>value.startsWith(name+'='));
  if(values.length!==1)throw new AuthClosed('UNAUTHENTICATED');
  const value=values[0]!.slice(name.length+1);
  if(!/^[A-Za-z0-9_-]{43}$/.test(value))throw new AuthClosed('UNAUTHENTICATED');return value;
}
export function verifyMutation(origin:string|undefined,expectedOrigin:string,csrf:string|undefined,expectedCsrf:string) {
  if(origin!==expectedOrigin||!csrf||!/^[A-Za-z0-9_-]{43}$/.test(csrf)||!timingSafeEqual(Buffer.from(csrf),Buffer.from(expectedCsrf)))throw new AuthClosed('FORBIDDEN');
}
/** Every callback runs under invitation → current authority lock until transaction ends. */
export class AuthService {
  constructor(private readonly options:{pool:Pool;control:ControlRepository;cipher:SessionCipher;ownerSubject:string;origin:string;
    nativeSession:(subject:string,payload:Record<string,unknown>)=>Promise<void>;nativeIdentity?:(subject:string,payload:Record<string,unknown>)=>Promise<void>;nativeRefresh?:(subject:string,payload:Record<string,unknown>)=>Promise<Record<string,unknown>>;journal?:AuthorityJournal;now?:()=>Date}) {}
  private now(){return this.options.now?.()??new Date();}
  /** Recheck a live T07 actor after private local-database I/O and immediately before writes. */
  async revalidateT07(client:PoolClient,principal:SessionPrincipal):Promise<void>{
    // sessionTransaction already holds this row lock for the whole activation transaction.
    // Re-reading under control_t07 must not require UPDATE privilege on identity.session.
    const row=(await client.query<SessionRow>(`SELECT cookie_hash,subject_id,scope,invitation_root_id,agency_id,epoch,issued_at,
      last_human_activity_at,absolute_expires_at,revoked_at,encrypted_oidc_tokens FROM identity.session WHERE cookie_hash=$1`,[principal.cookieHash])).rows[0];
    const now=this.now();
    if(!row||row.subject_id!==principal.subjectId||row.epoch!==principal.epoch.toString()||row.revoked_at
      ||row.absolute_expires_at<=now||row.last_human_activity_at.getTime()+30*60_000<=now.getTime())throw new AuthClosed('UNAUTHENTICATED');
    const payload=JSON.parse(this.options.cipher.decrypt(row.encrypted_oidc_tokens,{cookieHash:row.cookie_hash,
      subjectId:row.subject_id,epoch:BigInt(row.epoch)})) as unknown;
    if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new AuthClosed('UNAUTHENTICATED');
    try{await this.options.nativeSession(row.subject_id,payload as Record<string,unknown>);}
    catch(error){if(error instanceof NativeIdentityChanged)throw new AuthClosed('UNAUTHENTICATED');
      if(error instanceof NativeSessionEnded)throw new AuthClosed('UNAUTHENTICATED');throw new AuthClosed('DEPENDENCY_UNAVAILABLE');}
    const sidKey=nativeSidKey(this.options.origin+'/realms/dossiercle',(payload as Record<string,unknown>)['sid']);
    if((await client.query("SELECT 1 FROM control.idempotency_record WHERE actor_id=$1 AND operation_type='identity.sid-revoked' AND key=$2",
      ['00000000-0000-4000-8000-000000000030',sidKey])).rowCount)throw new AuthClosed('UNAUTHENTICATED');
    await this.options.control.withLockedAuthority(client,principal.subjectId,true,async()=>undefined);
  }
  async withSession<T>(cookie:string|undefined,mutation:{origin:string|undefined;csrf:string|undefined;humanActivity:true}|null,
    work:(client:PoolClient,principal:SessionPrincipal)=>Promise<T>):Promise<T> {
    return await this.sessionTransaction(cookie,mutation,false,work);
  }
  async withClaimSession<T>(cookie:string|undefined,mutation:{origin:string|undefined;csrf:string|undefined;humanActivity:true},
    work:(client:PoolClient,principal:SessionPrincipal)=>Promise<T>):Promise<T> {
    return await this.sessionTransaction(cookie,mutation,true,work);
  }
  /** Revalidation path for a fresh native proof; email and pre-auth context never grant authority. */
  async withBootstrap<T>(actor:BootstrapActor,work:(client:PoolClient,contact:string)=>Promise<T>):Promise<T>{
    const client=await this.options.pool.connect();
    try{
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout='2000ms'");await client.query("SET LOCAL statement_timeout='5000ms'");
      const invitation=(await client.query<{subject_id:string;root_id:string;contact:string;status:string;identity_status:string;version:string;owner_id:string;token_hash:string|null}>(
        'SELECT subject_id,root_id,contact,status,identity_status,version,owner_id,token_hash FROM control.agency_invitation WHERE root_id=$1 FOR SHARE',[actor.root])).rows[0];
      if(!invitation||invitation.subject_id!==actor.subject||invitation.root_id!==actor.root||invitation.version!==actor.version
        ||invitation.identity_status!=='CONFIRMED')throw new AuthClosed('UNAUTHENTICATED');
      const result=await this.options.control.withLockedAuthority(client,actor.subject,false,async(_client,authority)=>{
        if(authority.identityEpoch!==actor.epoch||authority.confirmedEpoch!==actor.epoch||authority.status!=='CONFIRMED')throw new AuthClosed('UNAUTHENTICATED');
        if(actor.scope==='platform'){
          if(actor.subject!==this.options.ownerSubject||invitation.owner_id!==this.options.ownerSubject||!['ISSUED','CLAIMED'].includes(invitation.status))throw new AuthClosed('FORBIDDEN');
        }else{
          if(invitation.status!=='CLAIMED'||actor.subject===this.options.ownerSubject||!actor.tokenHash||!actor.admissionReceipt||actor.tokenHash!==invitation.token_hash)throw new AuthClosed('UNAUTHENTICATED');
          await checkAdmission(client,{subject:actor.subject,root:actor.root,epoch:actor.epoch.toString(),version:actor.version,tokenHash:actor.tokenHash,admissionReceipt:actor.admissionReceipt});
        }
        return await work(client,invitation.contact);
      });
      await client.query('COMMIT');return result;
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  /** Private T05 services only. The resolver is re-run under real locks, never a trusted client flag. */
  async withT05Session<T,Decision=void>(cookie:string|undefined,mutation:{origin:string|undefined;csrf:string|undefined;humanActivity:true}|null,
    plan:T05LockPlan<Decision>,work:(client:PoolClient,principal:SessionPrincipal,locked:T05LockedContext,decision:Decision)=>Promise<T>):Promise<T> {
    return this.sessionTransaction(cookie,mutation,true,async(client,principal,locked,decision)=>{
      if(!locked)throw new AuthClosed('DEPENDENCY_UNAVAILABLE');
      // Human refresh changed the actor's J1 projection after the raw prelock snapshot.
      const actor=(await client.query<T05AuthorityRow>('SELECT * FROM identity.account_authority WHERE subject_id=$1',[principal.subjectId])).rows[0];
      if(!actor)throw new AuthClosed('UNAUTHENTICATED');
      const authorities=new Map(locked.authorities);authorities.set(principal.subjectId,actor);
      await client.query('SET LOCAL ROLE control_t05');
      return work(client,principal,{...locked,authorities},decision as Decision);
    },plan);
  }
  /** T07 uses a separate SQL capability and can only be entered through a server-owned lock plan. */
  async withT07Session<T,Decision=void>(cookie:string|undefined,mutation:{origin:string|undefined;csrf:string|undefined;humanActivity:true}|null,
    plan:T05LockPlan<Decision>,work:(client:PoolClient,principal:SessionPrincipal,locked:T05LockedContext,decision:Decision)=>Promise<T>):Promise<T> {
    if (plan.mode !== 't07') throw new AuthClosed('FORBIDDEN');
    return this.sessionTransaction(cookie,mutation,false,async(client,principal,locked,decision)=>{
      if(!locked)throw new AuthClosed('DEPENDENCY_UNAVAILABLE');
      const actor=(await client.query<T05AuthorityRow>('SELECT * FROM identity.account_authority WHERE subject_id=$1',[principal.subjectId])).rows[0];
      if(!actor)throw new AuthClosed('UNAUTHENTICATED');
      const authorities=new Map(locked.authorities);authorities.set(principal.subjectId,actor);
      await client.query('SET LOCAL ROLE control_t07');
      return work(client,principal,{...locked,authorities},decision as Decision);
    },plan);
  }
  private async sessionTransaction<T,Decision=void>(cookie:string|undefined,mutation:{origin:string|undefined;csrf:string|undefined;humanActivity:boolean}|null,
    allowUnclaimed:boolean,work:(client:PoolClient,principal:SessionPrincipal,locked?:T05LockedContext,decision?:Decision)=>Promise<T>,t05?:T05LockPlan<Decision>):Promise<T> {
    const cookieHash=hash(opaqueCookie(cookie));
    const initial=(await this.options.pool.query<SessionRow>('SELECT * FROM identity.session WHERE cookie_hash=$1',[cookieHash])).rows[0];
    if(!initial)throw new AuthClosed('UNAUTHENTICATED');
    if(t05?.mode==='owner'&&(initial.subject_id!==this.options.ownerSubject||initial.scope!=='platform'))throw new AuthClosed('FORBIDDEN');
    if(t05?.mode==='onboarding'&&(initial.scope!=='onboarding'||!initial.invitation_root_id))throw new AuthClosed('FORBIDDEN');
    if(t05?.mode==='agency-admin'&&(initial.scope!=='agency'||!initial.agency_id||!initial.invitation_root_id))throw new AuthClosed('FORBIDDEN');
    if(t05?.mode==='t07'&&(!['onboarding','agency'].includes(initial.scope)||!initial.invitation_root_id
      ||(initial.scope==='agency'&&!initial.agency_id)))throw new AuthClosed('FORBIDDEN');
    const client=await this.options.pool.connect();
    let committed=false;
    try {
      await client.query('BEGIN');
      if(t05){
        await client.query("SET LOCAL lock_timeout='2000ms'");
        await client.query("SET LOCAL statement_timeout='5000ms'");
        await t05.beforeLocks?.(client);
      }
      const t05Locked=t05?await lockT05Subjects(client,initial,t05):undefined;
      if(initial.invitation_root_id) {
        const invitation=(await client.query<{subject_id:string;status:string;identity_status:string;expires_at:Date|null}>(
          'SELECT subject_id,status,identity_status,expires_at FROM control.agency_invitation WHERE root_id=$1 FOR '+(t05?'UPDATE':'SHARE'),[initial.invitation_root_id])).rows[0];
        const platformOwner=initial.subject_id===this.options.ownerSubject&&initial.scope==='platform';
        const available=invitation?.status==='CLAIMED'||(invitation?.status==='ISSUED'&&(platformOwner||(allowUnclaimed&&invitation.expires_at&&invitation.expires_at>this.now())));
        if(!invitation||invitation.subject_id!==initial.subject_id||invitation.identity_status!=='CONFIRMED'||!available)throw new AuthClosed('INVITATION_UNAVAILABLE');
      }
      const result=await this.options.control.withLockedAuthority(client,initial.subject_id,true,async(_client,authority)=>{
        const row=(await client.query<SessionRow>('SELECT * FROM identity.session WHERE cookie_hash=$1 FOR UPDATE',[cookieHash])).rows[0];
        if(!row||row.subject_id!==initial.subject_id||row.invitation_root_id!==initial.invitation_root_id||row.scope!==initial.scope||row.agency_id!==initial.agency_id||row.epoch!==initial.epoch)throw new AuthClosed('UNAUTHENTICATED');
        const principal=await this.principal(row,authority,client);
        if(mutation)verifyMutation(mutation.origin,this.options.origin,mutation.csrf,principal.view.csrfToken);
        const payload=JSON.parse(this.options.cipher.decrypt(row.encrypted_oidc_tokens,{cookieHash,subjectId:row.subject_id,epoch:BigInt(row.epoch)})) as unknown;
        if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new AuthClosed('UNAUTHENTICATED');
        const sidKey=nativeSidKey(this.options.origin+'/realms/dossiercle',(payload as Record<string,unknown>)['sid']);
        const revoked=await client.query("SELECT 1 FROM control.idempotency_record WHERE actor_id=$1 AND operation_type='identity.sid-revoked' AND key=$2",['00000000-0000-4000-8000-000000000030',sidKey]);
        if(revoked.rowCount)throw new AuthClosed('UNAUTHENTICATED');
        // Native IdP session/factor checks are delegated to the private coordinator.
        try { await this.options.nativeSession(row.subject_id,payload as Record<string,unknown>); }
        catch(error) {
          if(error instanceof NativeIdentityChanged)await this.denyChangedIdentity(client,authority);
          else if(error instanceof NativeSessionEnded){
            const commandId=randomUUID();
            await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",['s01.sid:'+sidKey]);
            await client.query(`INSERT INTO control.idempotency_record(actor_id,operation_type,key,canonical_body_hash,resource_id,result)
              VALUES($1,'identity.sid-revoked',$2,$3,$2,'{"revoked":true}') ON CONFLICT DO NOTHING`,['00000000-0000-4000-8000-000000000030',sidKey,hash(commandId)]);
            await this.revoke(client,{subject:row.subject_id,epoch:principal.epoch,cookieHashes:[cookieHash],commandId,actorType:'service'});
          }else throw error;
          return {denied:true as const};
        }
        if(row.absolute_expires_at<=this.now()||row.last_human_activity_at.getTime()+30*60_000<=this.now().getTime())throw new AuthClosed('UNAUTHENTICATED');
        const decision=t05?.validate&&t05Locked?await t05.validate(client,principal,t05Locked):undefined;
        let refreshCommand:string|undefined;
        if(mutation?.humanActivity){
          if(!this.options.nativeRefresh)throw new AuthClosed('DEPENDENCY_UNAVAILABLE');
          refreshCommand=randomUUID();
          await this.transition(client,{subject:principal.subjectId,epoch:principal.epoch,commandId:refreshCommand,state:'PENDING',actorType:'human'});
          const refreshed=await this.options.nativeRefresh(row.subject_id,payload as Record<string,unknown>);
          const encrypted=this.options.cipher.encrypt(JSON.stringify(refreshed),{cookieHash,subjectId:row.subject_id,epoch:BigInt(row.epoch)});
          await client.query('UPDATE identity.session SET encrypted_oidc_tokens=$2,last_human_activity_at=$3 WHERE cookie_hash=$1',[cookieHash,encrypted,this.now()]);
        }
        if(refreshCommand)await this.transition(client,{subject:principal.subjectId,epoch:principal.epoch,commandId:refreshCommand,state:'CONFIRMED',actorType:'human'});
        const value=await work(client,principal,t05Locked,decision);
        if(t05?.afterWork)await t05.afterWork(client,principal);
        return {denied:false as const,value};
      });
      await client.query('COMMIT');committed=true;
      if(result.denied)throw new AuthClosed('UNAUTHENTICATED');
      return result.value;
    }catch(error){if(!committed)await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  private async denyChangedIdentity(client:PoolClient,authority:AuthorityProjection) {
    if(!this.options.journal)throw new AuthClosed('DEPENDENCY_UNAVAILABLE');
    const commandId=randomUUID(),epoch=authority.identityEpoch+1n;
    const actor={id:'00000000-0000-4000-8000-000000000030',type:'service' as const};
    // Durable independent denial precedes SQL; a crash leaves the old projection closed.
    const head=await this.options.journal.append(client,{subjectId:authority.subjectId,epoch,commandId,state:'DENIED',actor});
    await client.query(`UPDATE identity.account_authority SET identity_epoch=$2,confirmed_epoch=NULL,
      status='DENIED',enrollment_status='DENIED',recovery_ready=false,journal_sequence=$3,journal_hash=$4
      WHERE subject_id=$1`,[authority.subjectId,epoch.toString(),head.sequence.toString(),head.hash]);
    await client.query('UPDATE identity.session SET revoked_at=$2 WHERE subject_id=$1 AND revoked_at IS NULL',[authority.subjectId,this.now()]);
    await writeAudit(client,{eventId:commandId,agencyId:null,actorId:actor.id,actorType:actor.type,
      eventType:'identity.native-change.denied',resourceId:authority.subjectId,version:epoch,
      outcome:'denied',correlation:commandId,dispatch:false},'control_audit');
  }
  private async principal(row:SessionRow,authority:AuthorityProjection,client:PoolClient):Promise<SessionPrincipal> {
    const now=this.now();
    if(row.revoked_at||row.absolute_expires_at<=now||row.last_human_activity_at.getTime()+30*60_000<=now.getTime()
      ||BigInt(row.epoch)!==authority.identityEpoch)throw new AuthClosed('UNAUTHENTICATED');
    let scope:Session['scope'];let agencyId:string|null=null;
    if(row.scope==='platform'){if(row.subject_id!==this.options.ownerSubject)throw new AuthClosed('FORBIDDEN');scope='platform';}
    else {
      if(!row.invitation_root_id)throw new AuthClosed('FORBIDDEN');
      const agency=(await client.query<{id:string;state:string;role:string;membership_state:string}>(
        'SELECT * FROM control.lock_session_scope($1,$2)',[row.subject_id,row.invitation_root_id])).rows[0];
      if(agency?.state==='ACTIVE'&&agency.role==='ADMIN'&&agency.membership_state==='ACTIVE'){scope='agency';agencyId=agency.id;}
      else if(row.scope==='agency')throw new AuthClosed('FORBIDDEN');
      else scope='onboarding';
    }
    const context={cookieHash:row.cookie_hash,subjectId:row.subject_id,epoch:BigInt(row.epoch)};
    return {subjectId:row.subject_id,rootId:row.invitation_root_id,scope,agencyId,epoch:context.epoch,cookieHash:row.cookie_hash,issuedAt:row.issued_at.toISOString(),
      view:{scope,agencyId,csrfToken:this.options.cipher.csrf(context),idleExpiresAt:new Date(row.last_human_activity_at.getTime()+30*60_000).toISOString(),absoluteExpiresAt:row.absolute_expires_at.toISOString()}};
  }
  /** Called only by the coordinator after validated Code/MFA and invitation claim under locks. */
  async issue(client:PoolClient,input:{subjectId:string;rootId:string;scope:'onboarding'|'platform';epoch:bigint;nativePayload:Record<string,unknown>;receipt?:AdmissionContext}) {
    const sid=nativeSidKey(this.options.origin+'/realms/dossiercle',input.nativePayload['sid']);
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",['s01.sid:'+sid]);
    const tombstone=await client.query("SELECT 1 FROM control.idempotency_record WHERE actor_id=$1 AND operation_type='identity.sid-revoked' AND key=$2",['00000000-0000-4000-8000-000000000030',sid]);
    if(tombstone.rowCount)throw new AuthClosed('UNAUTHENTICATED');
    const value=randomBytes(32).toString('base64url');const cookieHash=hash(value);const now=this.now();
    const encrypted=this.options.cipher.encrypt(JSON.stringify(input.nativePayload),{cookieHash,subjectId:input.subjectId,epoch:input.epoch});
    if(input.scope==='platform'&&input.subjectId!==this.options.ownerSubject)throw new AuthClosed('FORBIDDEN');
    await client.query(`INSERT INTO identity.session(cookie_hash,subject_id,scope,invitation_root_id,issued_at,last_human_activity_at,absolute_expires_at,epoch,encrypted_oidc_tokens)
      VALUES($1,$2,$3,$4,$5,$5,$6,$7,$8)`,[cookieHash,input.subjectId,input.scope,input.rootId,now,new Date(now.getTime()+15*24*60*60_000),input.epoch.toString(),encrypted]);
    await client.query(`INSERT INTO control.idempotency_record(actor_id,operation_type,key,canonical_body_hash,resource_id,result)
      VALUES($1,'identity.native-session',$2,$3,$4,'{"bound":true}') ON CONFLICT DO NOTHING`,[input.subjectId,sid,hash(cookieHash),input.rootId]);
    if(input.scope==='onboarding'&&input.receipt)await writeOnboardingReceipt(client,{...input.receipt,cookieHash,subject:input.subjectId,
      root:input.rootId,epoch:input.epoch.toString(),issuedAt:now.toISOString()});
    return value;
  }
  async session(cookie:string|undefined) {return await this.sessionTransaction(cookie,null,true,async(_client,principal)=>principal.view);}
  async logout(cookie:string|undefined,origin:string|undefined,csrf:string|undefined) {
    await this.sessionTransaction(cookie,{origin,csrf,humanActivity:false},true,async(client,principal)=>{
      await this.revoke(client,{subject:principal.subjectId,epoch:principal.epoch,cookieHashes:[principal.cookieHash],commandId:randomUUID(),actorType:'human'});
    });
  }
  private async transition(client:PoolClient,input:{subject:string;epoch:bigint;commandId:string;state:'PENDING'|'CONFIRMED';actorType:'human'|'service'}){
    if(!this.options.journal)throw new AuthClosed('DEPENDENCY_UNAVAILABLE');
    const actor={id:input.actorType==='human'?input.subject:'00000000-0000-4000-8000-000000000030',type:input.actorType};
    const head=await this.options.journal.append(client,{subjectId:input.subject,epoch:input.epoch,commandId:input.commandId,state:input.state,actor});
    await client.query(`UPDATE identity.account_authority SET status=$2,confirmed_epoch=CASE WHEN $2='CONFIRMED' THEN identity_epoch ELSE NULL END,journal_sequence=$3,journal_hash=$4 WHERE subject_id=$1`,[input.subject,input.state,head.sequence.toString(),head.hash]);
  }
  private async revoke(client:PoolClient,input:{subject:string;epoch:bigint;cookieHashes:string[];commandId:string;actorType:'human'|'service'}){
    if(!this.options.journal)throw new AuthClosed('DEPENDENCY_UNAVAILABLE');
    const actor={id:input.actorType==='human'?input.subject:'00000000-0000-4000-8000-000000000030',type:input.actorType};
    const pending=await this.options.journal.append(client,{subjectId:input.subject,epoch:input.epoch,commandId:input.commandId,state:'PENDING',actor});
    await client.query(`UPDATE identity.account_authority SET status='PENDING',confirmed_epoch=NULL,journal_sequence=$2,journal_hash=$3 WHERE subject_id=$1`,[input.subject,pending.sequence.toString(),pending.hash]);
    await client.query('UPDATE identity.session SET revoked_at=$2 WHERE cookie_hash=ANY($1::text[]) AND revoked_at IS NULL',[input.cookieHashes,this.now()]);
    const confirmed=await this.options.journal.append(client,{subjectId:input.subject,epoch:input.epoch,commandId:input.commandId,state:'CONFIRMED',actor});
    await client.query(`UPDATE identity.account_authority SET status='CONFIRMED',confirmed_epoch=identity_epoch,journal_sequence=$2,journal_hash=$3 WHERE subject_id=$1`,[input.subject,confirmed.sequence.toString(),confirmed.hash]);
    await writeAudit(client,{eventId:input.commandId,agencyId:null,actorId:actor.id,actorType:actor.type,eventType:'identity.session.revoked',resourceId:input.subject,version:input.epoch,outcome:'succeeded',correlation:input.commandId,dispatch:false},'control_audit');
  }
  async nativeLogout(input:{subject:string|null;sid:string|null;jti:string}){
    const digest=hash('s01-bff:'+input.jti),commandId=`${digest.slice(0,8)}-${digest.slice(8,12)}-4${digest.slice(13,16)}-8${digest.slice(17,20)}-${digest.slice(20,32)}`;
    let subject=input.subject;
    if(input.sid){
      nativeSid(input.sid);
      const sidKey=nativeSidKey(this.options.origin+'/realms/dossiercle',input.sid);
      // Commit a signed SID tombstone before resolving a potentially uncommitted binding.
      const receipt=await this.options.pool.connect();
      try{
        await receipt.query('BEGIN');
        await receipt.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",['s01.sid:'+sidKey]);
        await receipt.query(`INSERT INTO control.idempotency_record(actor_id,operation_type,key,canonical_body_hash,resource_id,result)
          VALUES($1,'identity.sid-revoked',$2,$3,$2,'{"revoked":true}') ON CONFLICT DO NOTHING`,['00000000-0000-4000-8000-000000000030',sidKey,digest]);
        await receipt.query('COMMIT');
      }catch(error){await receipt.query('ROLLBACK');throw error;}finally{receipt.release();}
      const actors=(await this.options.pool.query<{actor_id:string}>('SELECT actor_id FROM control.idempotency_record WHERE operation_type=$1 AND key=$2',['identity.native-session',sidKey])).rows;
      if(!actors.length)return;
      if(actors.length!==1||(subject&&subject!==actors[0]!.actor_id))throw new AuthClosed('UNAUTHENTICATED');subject=actors[0]!.actor_id;
    }
    if(!subject)throw new AuthClosed('UNAUTHENTICATED');
    const initial=(await this.options.pool.query<SessionRow>('SELECT * FROM identity.session WHERE subject_id=$1',[subject])).rows;
    const root=initial[0]?.invitation_root_id;if(!root||initial.some(row=>row.invitation_root_id!==root))throw new AuthClosed('UNAUTHENTICATED');
    const client=await this.options.pool.connect();
    try{
      await client.query('BEGIN');await client.query('SELECT root_id FROM control.agency_invitation WHERE root_id=$1 FOR SHARE',[root]);
      await this.options.control.withLockedAuthority(client,subject,true,async(_client,authority)=>{
        const replay=(await client.query('SELECT 1 FROM control.idempotency_record WHERE actor_id=$1 AND operation_type=$2 AND key=$3',[subject,'identity.backchannel.logout',commandId])).rowCount;
        if(replay)return;
        const rows=(await client.query<SessionRow>('SELECT * FROM identity.session WHERE subject_id=$1 FOR UPDATE',[subject])).rows;const hashes:string[]=[];
        for(const row of rows){
          const payload=JSON.parse(this.options.cipher.decrypt(row.encrypted_oidc_tokens,{cookieHash:row.cookie_hash,subjectId:row.subject_id,epoch:BigInt(row.epoch)})) as Record<string,unknown>;
          if(!row.revoked_at&&(!input.sid||payload['sid']===input.sid)){
            hashes.push(row.cookie_hash);
          }
        }
        if(hashes.length)await this.revoke(client,{subject:subject!,epoch:authority.identityEpoch,cookieHashes:hashes,commandId,actorType:'service'});
        await client.query(`INSERT INTO control.idempotency_record(actor_id,operation_type,key,canonical_body_hash,resource_id,result)
          VALUES($1,'identity.backchannel.logout',$2,$3,$4,$5)`,[subject,commandId,digest,root,JSON.stringify({revoked:hashes.length})]);
      });await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
}
