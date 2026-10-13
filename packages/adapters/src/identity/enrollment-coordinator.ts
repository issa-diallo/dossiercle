import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { writeAudit } from '../audit/audit-writer.js';
import { nativeSid } from './native-sid.js';
import type { AuthorityJournal } from '../journal/authority-journal.js';
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export class EnrollmentClosed extends Error { constructor(reason?:string){super('INVITATION_UNAVAILABLE',reason?{cause:new Error(reason)}:undefined);} }
interface Invitation {contact:string;id:string;root_id:string;subject_id:string;status:string;version:string;token_hash:string|null;expires_at:Date|null;identity_status:string}
interface Authority {subject_id:string;identity_epoch:string;status:string;journal_sequence:string;journal_hash:string|null}
export interface EnrollmentGrant {readonly subject:string;readonly root:string;readonly version:string;readonly epoch:bigint;readonly expires:number}
export interface AuthorityLease {signal:AbortSignal;check:()=>Promise<void>}
function authorityLease(client:PoolClient){
  const controller=new AbortController();const lost=()=>controller.abort();client.on('error',lost);
  const lease:AuthorityLease={signal:controller.signal,check:async()=>{
    if(controller.signal.aborted)throw new EnrollmentClosed();
    const result=await client.query("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE pid=pg_backend_pid() AND locktype='transactionid' AND mode='ExclusiveLock' AND granted) AS held");
    if(controller.signal.aborted||result.rows[0]?.held!==true)throw new EnrollmentClosed();
  }};
  return {lease,release:()=>{controller.abort();client.removeListener('error',lost);}};
}
interface LiveGrant {value:EnrollmentGrant;nativeJwtHashes:Set<string>;keycloakSessions:Set<string>}
/** Restart destroys every live grant. Durable receipt prevents replay of its invitation version. */
export class EnrollmentCoordinator {
  private readonly grants=new Map<string,LiveGrant>();
  constructor(private readonly options:{pool:Pool;journal:AuthorityJournal;origin:string;now?:()=>number}) {}
  private now(){return this.options.now?.()??Date.now();}
  private sweep(){for(const [key,g] of this.grants)if(g.value.expires<=this.now())this.grants.delete(key);}
  async admit(token:string):Promise<{cookie:string;grant:EnrollmentGrant}> {
    if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new EnrollmentClosed();this.sweep();
    // A finite local capacity closes admission rather than evicting valid grants.
    if(this.grants.size>=100)throw new Error('DEPENDENCY_UNAVAILABLE');
    const cookie=randomBytes(32).toString('base64url'),client=await this.options.pool.connect();
    try {
      await client.query('BEGIN');
      const invitation=(await client.query<Invitation>('SELECT * FROM control.agency_invitation WHERE token_hash=$1 FOR SHARE',[digest(token)])).rows[0];
      if(!invitation)throw new EnrollmentClosed();
      const authority=await this.lock(client,invitation,true);
      const expires=Math.min(invitation.expires_at!.getTime(),this.now()+600_000);
      const grant={subject:invitation.subject_id,root:invitation.root_id,version:invitation.version,epoch:BigInt(authority.identity_epoch),expires};
      const operation='identity.enrollment.grant.'+invitation.version;
      const used=await client.query('SELECT 1 FROM control.idempotency_record WHERE actor_id=$1 AND operation_type=$2 AND key=$3',[grant.subject,operation,grant.root]);
      if(used.rowCount)throw new EnrollmentClosed();
      await client.query(`INSERT INTO control.idempotency_record(actor_id,operation_type,key,canonical_body_hash,resource_id,result)
        VALUES($1,$2,$3,$4,$3,$5)`,[grant.subject,operation,grant.root,digest(JSON.stringify({root:grant.root,version:grant.version})),JSON.stringify({consumed:true})]);
      await client.query('COMMIT');
      this.grants.set(digest(cookie),{value:grant,nativeJwtHashes:new Set(),keycloakSessions:new Set()});return {cookie,grant};
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  private async lock(client:PoolClient,invitation:Invitation,exclusive:boolean) {
    if(invitation.status!=='ISSUED'||invitation.identity_status!=='CONFIRMED'||!invitation.expires_at||invitation.expires_at.getTime()<=this.now())throw new EnrollmentClosed('GRANT_INVITATION_EXPIRED');
    const authority=(await client.query<Authority>('SELECT * FROM identity.account_authority WHERE subject_id=$1 FOR '+(exclusive?'UPDATE':'SHARE'),[invitation.subject_id])).rows[0];
    const head=await this.options.journal.head(invitation.subject_id);
    if(!authority||authority.status!=='PENDING'||!head||head.state!=='PENDING'||head.epoch!==BigInt(authority.identity_epoch)
      ||head.sequence!==BigInt(authority.journal_sequence)||head.hash!==authority.journal_hash)throw new EnrollmentClosed('GRANT_JOURNAL_NOT_CURRENT');
    return authority;
  }
  /** Holds invitation → authority locks through native result and SQL convergence. */
  async withGrant<T>(cookie:string,request:{mutation:boolean;origin?:string;nativeJwt?:string;mintJwt?:boolean;keycloakSession?:string;mintKeycloakSession?:boolean;technicalUsername?:string},
    work:(grant:EnrollmentGrant,lease:AuthorityLease)=>Promise<{value:T;mintedJwt?:string;mintedKeycloakSession?:string}>):Promise<T> {
    this.sweep();const live=this.grants.get(digest(cookie));
    if(!/^[A-Za-z0-9_-]{43}$/.test(cookie)||!live||live.value.expires<=this.now())throw new EnrollmentClosed('GRANT_MISSING_OR_EXPIRED');
    if(request.technicalUsername!==undefined&&request.technicalUsername!==live.value.subject)throw new EnrollmentClosed();
    if(request.mutation&&request.origin!==this.options.origin)throw new EnrollmentClosed();
    if(request.mintJwt&&(!request.mutation||request.nativeJwt))throw new EnrollmentClosed();
    if(request.keycloakSession&&!live.keycloakSessions.has(digest(request.keycloakSession)))throw new Error('BROWSER_SESSION_NOT_BOUND');
    if(request.mintKeycloakSession&&request.mutation)throw new EnrollmentClosed();
    if(!request.mintJwt&&request.nativeJwt!==undefined&&!live.nativeJwtHashes.has(digest(request.nativeJwt)))throw new EnrollmentClosed();
    const client=await this.options.pool.connect(),barrier=authorityLease(client);
    try {
      await client.query('BEGIN');
      const invitation=(await client.query<Invitation>('SELECT * FROM control.agency_invitation WHERE root_id=$1 FOR SHARE',[live.value.root])).rows[0];
      if(!invitation||invitation.subject_id!==live.value.subject||invitation.version!==live.value.version)throw new EnrollmentClosed('GRANT_INVITATION_VERSION_CHANGED');
      const authority=await this.lock(client,invitation,request.mutation);
      if(BigInt(authority.identity_epoch)!==live.value.epoch||live.value.expires<=this.now())throw new EnrollmentClosed('GRANT_MISSING_OR_EXPIRED');
      if(request.mutation&&!request.mintJwt) {
        if(!request.nativeJwt&&!request.keycloakSession)throw new EnrollmentClosed();
        const head=await this.options.journal.append(client,{subjectId:live.value.subject,commandId:randomUUID(),epoch:live.value.epoch,state:'PENDING',actor:{id:live.value.subject,type:'human'}});
        await client.query('UPDATE identity.account_authority SET journal_sequence=$2,journal_hash=$3 WHERE subject_id=$1',[live.value.subject,head.sequence.toString(),head.hash]);
      }
      await barrier.lease.check();
      const result=await work(live.value,barrier.lease);
      await barrier.lease.check();
      // Dead connection or expired grant forbids publication even after native success.
      if(live.value.expires<=this.now())throw new EnrollmentClosed('GRANT_MISSING_OR_EXPIRED');
      if(request.mintJwt) {
        if(!result.mintedJwt||result.mintedJwt.length>32768||live.nativeJwtHashes.size>=4)throw new EnrollmentClosed();
      }else if(result.mintedJwt)throw new EnrollmentClosed();
      if (result.mintedKeycloakSession) {
        if ((!request.mintKeycloakSession && !request.keycloakSession) || result.mintedKeycloakSession.length > 256
          || (live.keycloakSessions.size >= 4&&!live.keycloakSessions.has(digest(result.mintedKeycloakSession)))) throw new EnrollmentClosed();
      }
      await client.query('COMMIT');
      if(result.mintedJwt)live.nativeJwtHashes.add(digest(result.mintedJwt));
      if(result.mintedKeycloakSession)live.keycloakSessions.add(digest(result.mintedKeycloakSession));
      return result.value;
    }catch(error){await client.query('ROLLBACK');throw error;}finally{barrier.release();client.release();}
  }
  /** Private coordinator only: validator must use signed Code and current native APIs. */
  async confirm<T>(cookie:string,
    validate:(grant:EnrollmentGrant,expected:{contact:string},lease:AuthorityLease)=>Promise<{subject:string;sid:string;passwordConfigured:boolean;recoveryReady:boolean;enrollmentVerified:boolean;nativePayload:Record<string,unknown>}>,
    issue:(client:PoolClient,grant:EnrollmentGrant,nativePayload:Record<string,unknown>)=>Promise<T>):Promise<T> {
    this.sweep();const live=this.grants.get(digest(cookie));
    if(!/^[A-Za-z0-9_-]{43}$/.test(cookie)||!live||live.value.expires<=this.now())throw new EnrollmentClosed('GRANT_MISSING_OR_EXPIRED');
    const client=await this.options.pool.connect(),barrier=authorityLease(client);
    try {
      await client.query('BEGIN');
      const invitation=(await client.query<Invitation>('SELECT * FROM control.agency_invitation WHERE root_id=$1 FOR SHARE',[live.value.root])).rows[0];
      if(!invitation||invitation.subject_id!==live.value.subject||invitation.version!==live.value.version)throw new EnrollmentClosed('GRANT_INVITATION_VERSION_CHANGED');
      const authority=await this.lock(client,invitation,true);
      if(BigInt(authority.identity_epoch)!==live.value.epoch)throw new EnrollmentClosed();
      const commandId=randomUUID();
      await this.options.journal.append(client,{subjectId:live.value.subject,commandId,epoch:live.value.epoch,state:'PENDING',actor:{id:live.value.subject,type:'human'}});
      await barrier.lease.check();
      const confirmation=await validate(live.value,{contact:invitation.contact},barrier.lease);
      await barrier.lease.check();
      if(confirmation.subject!==live.value.subject)throw new EnrollmentClosed('CONFIRM_SUBJECT_MISMATCH');
      nativeSid(confirmation.sid);
      if(confirmation.passwordConfigured!==true)throw new EnrollmentClosed('CONFIRM_PASSWORD_ABSENT');
      if(confirmation.recoveryReady!==true)throw new EnrollmentClosed('CONFIRM_RECOVERY_ABSENT');
      if(confirmation.enrollmentVerified!==true)throw new EnrollmentClosed('CONFIRM_ENROLLMENT_ABSENT');
      if(live.value.expires<=this.now())throw new EnrollmentClosed('CONFIRM_GRANT_EXPIRED');
      const head=await this.options.journal.append(client,{subjectId:live.value.subject,commandId,epoch:live.value.epoch,state:'CONFIRMED',actor:{id:live.value.subject,type:'human'}});
      await client.query(`UPDATE identity.account_authority SET status='CONFIRMED',confirmed_epoch=identity_epoch,enrollment_status='VERIFIED',recovery_ready=true,
        journal_sequence=$2,journal_hash=$3 WHERE subject_id=$1`,[live.value.subject,head.sequence.toString(),head.hash]);
      await writeAudit(client,{eventId:commandId,agencyId:null,actorId:live.value.subject,actorType:'human',eventType:'identity.enrollment.confirmed',resourceId:live.value.subject,
        version:live.value.epoch,outcome:'succeeded',correlation:commandId,dispatch:false},'control_audit');
      const result=await issue(client,live.value,confirmation.nativePayload);
      await client.query('COMMIT');this.close(cookie);return result;
    }catch(error){await client.query('ROLLBACK');throw error;}finally{barrier.release();client.release();}
  }
  close(cookie:string){this.grants.delete(digest(cookie));}
  keycloakSessionBound(cookie:string,session:string) {
    const live=this.grants.get(digest(cookie));
    return Boolean(live&&live.value.expires>this.now()&&live.keycloakSessions.has(digest(session)));
  }
}
