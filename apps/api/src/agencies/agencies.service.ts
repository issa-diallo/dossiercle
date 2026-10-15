import { randomUUID,timingSafeEqual } from 'node:crypto';
import type { PoolClient } from '@dossiercle/adapters/postgres/runtime-pool';
import { creationDecision,canonicalAgencyName } from '@dossiercle/domain';
import { readOnboardingReceipt } from '@dossiercle/adapters/identity/onboarding-receipt';
import { putT05Record,readT05Record,t05Audit,t05Hash,T05Closed,type InvitationRow } from '@dossiercle/adapters/postgres/t05.repository';
import { opaqueCookie,type SessionPrincipal } from '../auth/auth.service.js';
import type { T05LockPlan } from '../auth/t05-locks.js';
import { mutation,type T05CommandRequest,type PrivateAuth } from '../platform/t05-context.js';

interface AgencyRow {id:string;name:string;canonical_name_hash:string;state:string;version:string;operation_id:string|null;step:string;operation_status:string}
const accepted=(row:AgencyRow)=>({agencyId:row.id,operationId:row.operation_id!,state:row.state,version:row.version,statusUrl:`/v1/agencies/${row.id}/activation`});
export class AgenciesService {
  constructor(private readonly options:{auth:PrivateAuth;now?:()=>Date}){}
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
    const row=(await client.query<AgencyRow>(`SELECT a.id,a.name,a.canonical_name_hash,a.state,a.version,o.id AS operation_id,o.step,o.status AS operation_status
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
    plan.validate=async(client,principal)=>{
      const {row}=await this.context(client,principal);if(row.status!=='CLAIMED')throw new T05Closed('INVITATION_UNAVAILABLE');
      const replay=await readT05Record(client,principal.subjectId,'t05.agency-create.v1',request.key,bodyHash);
      const existing=await this.agency(client,row.root_id);creationDecision(existing?{canonicalNameHash:existing.canonical_name_hash}:null,canonical.name);
      if(replay&&!existing)throw new T05Closed('DEPENDENCY_UNAVAILABLE');
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
      return id?{agencyId:agency.id,name:agency.name,state:agency.state,step:agency.step,version:agency.version,errorCode:null,
        retryable:false,canActivate:false,canRetry:false,automationEnabled:false as const}:accepted(agency);
    });
  }
}
