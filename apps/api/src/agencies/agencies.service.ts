import { randomUUID,timingSafeEqual } from 'node:crypto';
import type { PoolClient } from '@dossiercle/adapters/postgres/runtime-pool';
import { creationDecision,canonicalAgencyName,retryDecision } from '@dossiercle/domain';
import { readOnboardingReceipt } from '@dossiercle/adapters/identity/onboarding-receipt';
import { putT05Record,readT05Record,t05Audit,t05Hash,T05Closed,type InvitationRow } from '@dossiercle/adapters/postgres/t05.repository';
import { opaqueCookie,AuthClosed,type SessionPrincipal } from '../auth/auth.service.js';
import type { T05LockPlan } from '../auth/t05-locks.js';
import { mutation,type T05CommandRequest,type PrivateAuth } from '../platform/t05-context.js';
import {T05RequestClosed} from '../http/t05-request.js';
import { ActivationRepository, type ActivationSnapshot, type PreparedAudit } from '@dossiercle/adapters/postgres/activation.repository';

interface AgencyRow {id:string;name:string;canonical_name_hash:string;state:string;version:string;operation_id:string|null;step:string;operation_status:string;last_error_code:string|null;retryable:boolean}
const accepted=(row:AgencyRow)=>({agencyId:row.id,operationId:row.operation_id!,state:row.state,version:row.version,statusUrl:`/v1/agencies/${row.id}/activation`});
export class AgenciesService {
  private readonly activation=new ActivationRepository();
  constructor(private readonly options:{auth:PrivateAuth;now?:()=>Date;activationAudit?:{
    prepare(input:{reservationId:string;eventId:string}):Promise<void>;
    read(input:{reservationId:string;eventId:string}):Promise<PreparedAudit>;
  }}){}
  private t07Plan(cookie:string|undefined,id?:string,action?:{kind:'activation'|'retry';key:string;version:bigint;bodyHash:string}){
    const cookieHash=t05Hash(opaqueCookie(cookie));
    return {mode:'t07' as const,beforeLocks:async(client:PoolClient)=>{
      if(action?.kind==='retry')await client.query("SELECT pg_advisory_xact_lock(hashtextextended('s01.t06.agency-create-admission',0))");
    },resolve:async(client:PoolClient)=>{
      const session=(await client.query<{subject_id:string;invitation_root_id:string|null}>('SELECT subject_id,invitation_root_id FROM identity.session WHERE cookie_hash=$1',[cookieHash])).rows[0];
      if(!session?.invitation_root_id)return [];
      return [{rootId:session.invitation_root_id,subjectId:session.subject_id,authority:'existing' as const,invitation:'existing' as const}];
    },validate:async(client:PoolClient,principal:SessionPrincipal)=>{
      if(!id)return;
      const snapshot=this.requireAgency(await this.snapshotFor(client,principal,id),principal,id);
      if(!action)return snapshot;
      const operationType=action.kind==='activation'?'t07.agency-activation.v1':'t07.provisioning-retry.v1';
      const previous=(await client.query<{canonical_body_hash:string;resource_id:string}>('SELECT canonical_body_hash,resource_id FROM control.idempotency_record WHERE actor_id=$1 AND operation_type=$2 AND key=$3',
        [principal.subjectId,operationType,action.key])).rows[0];
      if(previous){
        if(previous.canonical_body_hash!==action.bodyHash||previous.resource_id!==snapshot.agencyId)throw new T05Closed('IDEMPOTENCY_CONFLICT');
        if(action.kind==='activation'&&snapshot.state!=='ACTIVE')throw new T05Closed('DEPENDENCY_UNAVAILABLE');
        return snapshot;
      }
      if(action.kind==='activation'){
        if(snapshot.state==='ACTIVE')return snapshot;
        if(BigInt(snapshot.version)!==action.version)throw new T05Closed('VERSION_CONFLICT');
        if(!this.options.activationAudit)throw new T05Closed('DEPENDENCY_UNAVAILABLE');
        this.activation.assertReady(snapshot);
      }else{
        if(BigInt(snapshot.version)!==action.version)throw new T05Closed('VERSION_CONFLICT');
        retryDecision({state:snapshot.state as 'READY'|'ACTIVE'|'FAILED'|'PROVISIONING',operationStatus:snapshot.operationStatus as 'PENDING'|'RUNNING'|'SUCCEEDED'|'FAILED',
          retryable:snapshot.retryable,attempt:snapshot.attempt,gateIdle:snapshot.gateIdle,executionUncertain:snapshot.uncertainExecution});
        if(snapshot.membershipState!=='PENDING'||snapshot.role!=='ADMIN')throw new T05Closed('NOT_READY');
        const backlog=Number((await client.query("SELECT count(*)::int AS n FROM control.agency a JOIN control.provisioning_operation o ON o.agency_id=a.id WHERE o.status IN ('PENDING','RUNNING') OR (o.status='FAILED' AND o.retryable) OR EXISTS(SELECT 1 FROM control.provisioning_execution e WHERE e.operation_id=o.id AND e.state IN ('RUNNING','BLOCKED'))")).rows[0]?.n??0);
        if(backlog>=100)throw new T05RequestClosed(429,60);
      }
      return snapshot;
    }};
  }
  private snapshotFor(client:PoolClient,principal:SessionPrincipal,id:string){
    return this.activation.snapshot(client,id,principal.subjectId);
  }
  private requireAgency(snapshot:ActivationSnapshot|null,principal:SessionPrincipal,id:string):ActivationSnapshot{
    if(!snapshot||snapshot.rootId!==principal.rootId||(principal.scope==='agency'&&principal.agencyId!==id))throw new T05Closed('NOT_FOUND');
    if(snapshot.role!=='ADMIN')throw new T05Closed('FORBIDDEN');
    return snapshot;
  }
  private view(snapshot:ActivationSnapshot){
    const ready=snapshot.state==='READY'&&snapshot.operationStatus==='SUCCEEDED'&&snapshot.step==='READY'
      &&snapshot.membershipState==='PENDING'&&snapshot.proofCount===6&&snapshot.confirmedProofCount===6
      &&snapshot.readySchemaVersion===1&&snapshot.schemaVersion===1&&snapshot.verificationVersion===String(snapshot.secretVersion)
      &&Boolean(this.options.activationAudit)
      &&Boolean(snapshot.locatorName&&snapshot.runtimeRole&&snapshot.migrationRole&&snapshot.migrationSecretRef&&snapshot.secretRef)
      &&snapshot.gateIdle&&!snapshot.uncertainExecution;
    const step=snapshot.step==='DB_CREATED'?'DATABASE_CREATED':snapshot.step;
    const errorCode=snapshot.errorCode===null?null:snapshot.errorCode==='RESOURCE_CONFLICT'?'PROVISIONING_CONFLICT'
      :snapshot.errorCode==='DEPENDENCY_UNAVAILABLE'?'DEPENDENCY_UNAVAILABLE':'PROVISIONING_FAILED';
    return {agencyId:snapshot.agencyId,name:snapshot.name,state:snapshot.state,step,version:snapshot.version,
      errorCode,retryable:snapshot.retryable,canActivate:ready,canRetry:snapshot.state==='FAILED'&&snapshot.operationStatus==='FAILED'
        &&snapshot.retryable&&snapshot.attempt<4&&snapshot.gateIdle&&!snapshot.uncertainExecution,automationEnabled:false as const};
  }
  async getActivation(cookie:string|undefined,id:string){
    const plan=this.t07Plan(cookie,id);
    return this.options.auth.withT07Session(cookie,null,plan,async(client,principal)=>{
      return this.view(this.requireAgency(await this.snapshotFor(client,principal,id),principal,id));
    });
  }
  private plan<Decision=void>(cookie:string|undefined):T05LockPlan<Decision>{
    const cookieHash=t05Hash(opaqueCookie(cookie));
    return {mode:'onboarding',resolve:async client=>{
      const session=(await client.query<{subject_id:string;invitation_root_id:string}>('SELECT subject_id,invitation_root_id FROM identity.session WHERE cookie_hash=$1',[cookieHash])).rows[0];
      if(!session?.invitation_root_id)throw new T05Closed('FORBIDDEN');
      return [{rootId:session.invitation_root_id,subjectId:session.subject_id,authority:'existing',invitation:'existing'}];
    }};
  }
  private async context(client:PoolClient,principal:SessionPrincipal){
    if(principal.scope!=='onboarding'||!principal.rootId)throw new T05Closed('FORBIDDEN');
    const row=(await client.query<InvitationRow>('SELECT * FROM control.agency_invitation WHERE root_id=$1',[principal.rootId])).rows[0];
    if(!row||row.subject_id!==principal.subjectId||!['ISSUED','CLAIMED'].includes(row.status))throw new T05Closed('INVITATION_UNAVAILABLE');
    const receipt=await readOnboardingReceipt(client,{cookieHash:principal.cookieHash,subject:principal.subjectId,root:principal.rootId,
      epoch:principal.epoch.toString(),version:row.version,tokenHash:row.token_hash,issuedAt:principal.issuedAt});
    return {row,receipt};
  }
  private async agency(client:PoolClient,root:string):Promise<AgencyRow|null>{
    const row=(await client.query<AgencyRow>(`SELECT a.id,a.name,a.canonical_name_hash,a.state,a.version,o.id AS operation_id,o.step,o.status AS operation_status,o.last_error_code,o.retryable
      FROM control.agency a LEFT JOIN control.provisioning_operation o ON o.agency_id=a.id WHERE a.invitation_root_id=$1`,[root])).rows[0];
    if(row&&!row.operation_id)throw new T05Closed('DEPENDENCY_UNAVAILABLE');return row??null;
  }
  async claim(request:T05CommandRequest,body:Record<string,never>|{token:string}){
    const plan=this.plan<Readonly<{row:InvitationRow}>>(request.cookie);
    plan.validate=async(client,principal)=>{
      const {row,receipt}=await this.context(client,principal);
      if('token' in body&&!timingSafeEqual(Buffer.from(t05Hash(body.token)),Buffer.from(receipt.tokenHash)))throw new T05Closed('INVITATION_UNAVAILABLE');
      if(row.status!=='CLAIMED'&&(!row.expires_at||row.expires_at<=(this.options.now?.()??new Date())))throw new T05Closed('INVITATION_UNAVAILABLE');
      return Object.freeze({row:Object.freeze(row)});
    };
    return this.options.auth.withT05Session(request.cookie,mutation(request),plan,async(client,principal,_locked,{row})=>{
      if(row.status==='CLAIMED')return {invitationId:row.id,status:'CLAIMED' as const};
      await client.query("UPDATE control.agency_invitation SET status='CLAIMED' WHERE id=$1",[row.id]);
      await t05Audit(client,{actor:principal.subjectId,root:row.root_id,type:'invitation.claimed',version:BigInt(row.version),dispatch:false});
      return {invitationId:row.id,status:'CLAIMED' as const};
    });
  }
  async create(request:T05CommandRequest,name:string){
    const canonical=canonicalAgencyName(name),bodyHash=t05Hash(JSON.stringify({name:canonical.name}));
    const plan=this.plan<Readonly<{row:InvitationRow;existing:AgencyRow|null;replay:unknown}>>(request.cookie);
    plan.beforeLocks=async client=>{await client.query("SELECT pg_advisory_xact_lock(hashtextextended('s01.t06.agency-create-admission',0))");};
    plan.validate=async(client,principal)=>{
      const {row}=await this.context(client,principal);if(row.status!=='CLAIMED')throw new T05Closed('INVITATION_UNAVAILABLE');
      const replay=await readT05Record(client,principal.subjectId,'t05.agency-create.v1',request.key,bodyHash);
      const existing=await this.agency(client,row.root_id);creationDecision(existing?{canonicalNameHash:existing.canonical_name_hash}:null,canonical.name);
      if(replay&&!existing)throw new T05Closed('DEPENDENCY_UNAVAILABLE');
      if(!replay&&!existing){
        const backlog=Number((await client.query("SELECT count(*)::int AS n FROM control.agency a JOIN control.provisioning_operation o ON o.agency_id=a.id WHERE o.status IN ('PENDING','RUNNING') OR (o.status='FAILED' AND o.retryable) OR EXISTS(SELECT 1 FROM control.provisioning_execution e WHERE e.operation_id=o.id AND e.state IN ('RUNNING','BLOCKED'))")).rows[0]?.n??0);
        if(backlog>=100)throw new T05RequestClosed(429,60);
      }
      return Object.freeze({row:Object.freeze(row),existing:existing?Object.freeze(existing):null,replay});
    };
    return this.options.auth.withT05Session(request.cookie,mutation(request),plan,async(client,principal,_locked,{row,existing,replay})=>{
      if(replay)return accepted(existing!);
      if(existing){
        await putT05Record(client,principal.subjectId,'t05.agency-create.v1',request.key,bodyHash,row.root_id,{agencyId:existing.id,operationId:existing.operation_id});
        return accepted(existing);
      }
      const agencyId=randomUUID(),operationId=randomUUID();
      await client.query('INSERT INTO control.agency(id,invitation_root_id,name,canonical_name_hash) VALUES($1,$2,$3,$4)',[agencyId,row.root_id,canonical.name,canonical.hash]);
      await client.query("INSERT INTO identity.membership(subject_id,agency_id,role) VALUES($1,$2,'ADMIN')",[principal.subjectId,agencyId]);
      await client.query('INSERT INTO control.provisioning_operation(id,agency_id) VALUES($1,$2)',[operationId,agencyId]);
      await putT05Record(client,principal.subjectId,'t05.agency-create.v1',request.key,bodyHash,row.root_id,{agencyId,operationId});
      await t05Audit(client,{actor:principal.subjectId,root:row.root_id,agencyId,type:'agency.creation-accepted',version:1n});
      return accepted((await this.agency(client,row.root_id))!);
    });
  }
  async get(cookie:string|undefined,id?:string){
    return this.options.auth.withT05Session(cookie,null,this.plan(cookie),async(client,principal)=>{
      const {row}=await this.context(client,principal);
      const agency=await this.agency(client,row.root_id);
      if(id&&agency?.id!==id)throw new T05Closed('NOT_FOUND');
      if(!agency)return null;
      return id?{agencyId:agency.id,name:agency.name,state:agency.state,step:agency.step,version:agency.version,errorCode:agency.last_error_code===null?null:agency.last_error_code==='RESOURCE_CONFLICT'?'PROVISIONING_CONFLICT':agency.last_error_code==='DEPENDENCY_UNAVAILABLE'?'DEPENDENCY_UNAVAILABLE':'PROVISIONING_FAILED',
        retryable:agency.retryable,canActivate:false,canRetry:false,automationEnabled:false as const}:accepted(agency);
    });
  }
  async activate(request:T05CommandRequest,id:string){
    if(request.version===undefined)throw new T05Closed('INVALID_REQUEST');
    const bodyHash=t05Hash('{}'),plan=this.t07Plan(request.cookie,id,{kind:'activation',key:request.key,version:request.version,bodyHash});
    let reservation:Awaited<ReturnType<ActivationRepository['reserve']>>|undefined;
    const already=await this.options.auth.withT07Session(request.cookie,mutation(request),plan,async(client,principal)=>{
      const snapshot=this.requireAgency(await this.snapshotFor(client,principal,id),principal,id);
      const record=(await client.query<{canonical_body_hash:string;resource_id:string}>('SELECT canonical_body_hash,resource_id FROM control.idempotency_record WHERE actor_id=$1 AND operation_type=$2 AND key=$3',
        [principal.subjectId,'t07.agency-activation.v1',request.key])).rows[0];
      if(record){if(record.canonical_body_hash!==bodyHash||record.resource_id!==snapshot.agencyId)throw new T05Closed('IDEMPOTENCY_CONFLICT');
        if(snapshot.state==='ACTIVE')return this.view(snapshot);throw new T05Closed('DEPENDENCY_UNAVAILABLE');}
      if(snapshot.state==='ACTIVE')return this.view(snapshot);
      if(BigInt(snapshot.version)!==request.version)throw new T05Closed('VERSION_CONFLICT');
      reservation=await this.activation.reserve(client,snapshot);
      return null;
    });
    if(already)return already;
    try{await this.options.activationAudit!.prepare({reservationId:reservation!.reservationId,eventId:reservation!.prepared.eventId});}
    catch{throw new T05Closed('DEPENDENCY_UNAVAILABLE');}
    try{
      // The request already passed CSRF and performed its human refresh before local I/O.
      // Revalidation after that I/O must not append another fsynced J1 transition: if
      // expiry/native validation then fails, rolling back SQL cannot roll back J1.
      await this.options.auth.withT07Session(request.cookie,null,plan,async(client,principal)=>{
        const snapshot=this.requireAgency(await this.snapshotFor(client,principal,id),principal,id);
        if(snapshot.state==='ACTIVE')return;
        const prepared=await this.options.activationAudit!.read({reservationId:reservation!.reservationId,eventId:reservation!.prepared.eventId});
        await this.options.auth.revalidateT07(client,principal);
        await this.activation.finalize(client,{snapshot,reservation:reservation!,prepared,actorId:principal.subjectId,
          idempotencyKey:request.key,bodyHash,correlation:reservation!.prepared.correlation});
      });
    }catch(error){
      if(error instanceof T05Closed)throw error;
      if(error instanceof AuthClosed)throw new T05Closed(error.code);
      const raw=error instanceof Error&&'code' in error?String(error.code):error instanceof Error?error.message:'';
      if(['NOT_READY','VERSION_CONFLICT','IDEMPOTENCY_CONFLICT','UNAUTHENTICATED','FORBIDDEN','INVITATION_UNAVAILABLE','AUTHORITY_DENIED','AUTHORITY_UNAVAILABLE'].includes(raw))
        throw new T05Closed(raw);
      throw new T05Closed('DEPENDENCY_UNAVAILABLE');
    }
    return await this.getActivation(request.cookie,id);
  }
  async retry(request:T05CommandRequest,id:string){
    if(request.version===undefined)throw new T05Closed('INVALID_REQUEST');
    const bodyHash=t05Hash('{}'),plan=this.t07Plan(request.cookie,id,{kind:'retry',key:request.key,version:request.version,bodyHash});
    const result=await this.options.auth.withT07Session(request.cookie,mutation(request),plan,async(client,principal)=>{
      const snapshot=this.requireAgency(await this.snapshotFor(client,principal,id),principal,id);
      const previous=(await client.query<{canonical_body_hash:string;resource_id:string;result:{agencyId:string;operationId:string}}>(
        'SELECT canonical_body_hash,resource_id,result FROM control.idempotency_record WHERE actor_id=$1 AND operation_type=$2 AND key=$3',
        [principal.subjectId,'t07.provisioning-retry.v1',request.key])).rows[0];
      if(previous){if(previous.canonical_body_hash!==bodyHash||previous.resource_id!==id||previous.result.agencyId!==id)
        throw new T05Closed('IDEMPOTENCY_CONFLICT');return {agencyId:id,operationId:previous.result.operationId,state:snapshot.state,version:snapshot.version,
          statusUrl:`/v1/agencies/${id}/activation`};}
      await this.activation.retry(client,{snapshot,actorId:principal.subjectId,key:request.key,bodyHash,
        expectedVersion:request.version!,correlation:randomUUID()});
      return {agencyId:id,operationId:snapshot.operationId,state:'PROVISIONING' as const,
        version:(BigInt(snapshot.version)+1n).toString(),statusUrl:`/v1/agencies/${id}/activation`};
    });
    return result;
  }
}
