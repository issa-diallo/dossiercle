import { randomBytes,randomUUID } from 'node:crypto';
import type { AuthorityJournal } from '@dossiercle/adapters/journal/authority-journal';
import { OwnerProofVerifier } from '@dossiercle/adapters/identity/owner-proof';
import { readOwnerConfirmation,readCurrentOwnerConfirmation,type OwnerProofRefs } from '@dossiercle/adapters/identity/owner-confirmation';
import { invitationById,invitationView,putT05Record,readT05Record,requireInvitation,refuseActive,t05Audit,t05Hash,T05Closed } from '@dossiercle/adapters/postgres/t05.repository';
import { UUID } from '@dossiercle/contracts';
import type { KeycloakAdapter } from '@dossiercle/adapters/identity/keycloak-adapter';
import { InvitationPreparationService,assertNativeInvitation,type PreparationCommand } from './invitation-preparation.service.js';
import { mutation,ownerInvitationPlan,type T05CommandRequest,type PrivateAuth } from './t05-context.js';

interface GrantCommand {commandId:string;sourceVersion:string;version:string;epoch:string;reset:boolean;action:'issue'|'revoke'}
const operation=(action:string,part:string)=>`t05.${action}-${part}.v1`;
function validCommand(value:GrantCommand):GrantCommand{
  if(!UUID.safeParse(value.commandId).success||!['issue','revoke'].includes(value.action)||typeof value.reset!=='boolean'
    ||[value.sourceVersion,value.version,value.epoch].some(number=>typeof number!=='string'||!/^[1-9][0-9]{0,15}$/.test(number))
    ||BigInt(value.version)!==BigInt(value.sourceVersion)+1n)throw new T05Closed('DEPENDENCY_UNAVAILABLE');
  return value;
}
export class InvitationsService {
  private readonly preparation:InvitationPreparationService;
  constructor(private readonly options:{auth:PrivateAuth;proof:OwnerProofVerifier;journal:AuthorityJournal;origin:string;
    native:Pick<KeycloakAdapter,'user'|'createUser'>;now?:()=>Date}){this.preparation=new InvitationPreparationService(options);}
  private now(){return this.options.now?.()??new Date();}
  async create(request:T05CommandRequest,refs:OwnerProofRefs){
    const bodyHash=t05Hash(JSON.stringify({email:refs.email,identityConfirmationRef:refs.identityConfirmationRef,recoveryChannelRef:refs.recoveryChannelRef}));
    const accepted=await this.options.auth.withT05Session(request.cookie,mutation(request),{mode:'owner',resolve:async client=>{
      const proof=await readOwnerConfirmation(client,refs,this.options.proof);
      return [{rootId:proof.rootId,subjectId:proof.subjectId,authority:'optional',invitation:'reservation'}];
    },validate:async(client,principal)=>{
      const proof=await readOwnerConfirmation(client,refs,this.options.proof);
      const replay=await readT05Record<{invitationId:string}>(client,principal.subjectId,'t05.invitation-create.v1',request.key,bodyHash);
      const existing=await invitationById(client,proof.invitationId);
      if(existing&&(existing.root_id!==proof.rootId||existing.subject_id!==proof.subjectId||existing.owner_id!==principal.subjectId||existing.contact!==refs.email))throw new T05Closed('CREATION_CONFLICT');
      if(replay&&(!existing||existing.id!==replay.invitationId))throw new T05Closed('DEPENDENCY_UNAVAILABLE');
      return Object.freeze({proof:Object.freeze(proof),existing:existing?Object.freeze(existing):null,replay:Boolean(replay)});
    }},async(client,principal,_locked,{proof,existing,replay})=>{
      if(replay)return {invitationId:existing!.id,status:'PENDING_IDENTITY' as const};
      if(!existing){
        await client.query(`INSERT INTO control.agency_invitation(id,root_id,subject_id,contact,owner_id,recovery_channel_ref) VALUES($1,$2,$3,$4,$5,$6)`,
          [proof.invitationId,proof.rootId,proof.subjectId,refs.email,principal.subjectId,proof.recoveryChannelRef]);
        await putT05Record(client,principal.subjectId,'t05.prepare-command.v1',proof.rootId,t05Hash(proof.rootId),proof.rootId,{commandId:randomUUID(),epoch:'1'} satisfies PreparationCommand);
        await t05Audit(client,{actor:principal.subjectId,root:proof.rootId,type:'invitation.pending',version:1n});
      }
      await putT05Record(client,principal.subjectId,'t05.invitation-create.v1',request.key,bodyHash,proof.rootId,{invitationId:proof.invitationId});
      return {invitationId:proof.invitationId,status:'PENDING_IDENTITY' as const};
    });
    // TXA has committed. No nested transaction or background non-durable work.
    await this.preparation.prepare(request,accepted.invitationId);
    return accepted;
  }
  async get(cookie:string|undefined,id:string){
    return this.options.auth.withT05Session(cookie,null,ownerInvitationPlan(id,'optional'),async client=>invitationView(await requireInvitation(client,id)));
  }
  async issue(request:T05CommandRequest,id:string):Promise<{invitationId:string;status:string;version:string;enrollmentUrl?:string}>{
    const bodyHash=t05Hash(JSON.stringify({invitationId:id,action:'issue'}));
    // The actual preparation transaction checks replay/body/version under the same
    // prelocks before refresh or native reconciliation. No earlier effectful probe.
    await this.preparation.prepare(request,id,async(client,principal,row)=>{
      const previous=await readT05Record<GrantCommand>(client,principal.subjectId,operation('issue','command'),request.key,bodyHash);
      if(previous){
        const command=validCommand(previous);
        if(await readT05Record(client,principal.subjectId,operation('issue','complete'),request.key,bodyHash))return false;
        if(row.status==='REVOKED'||row.version!==command.sourceVersion)throw new T05Closed('VERSION_CONFLICT');
      }else if(row.status==='REVOKED'||request.version===undefined||request.version!==BigInt(row.version))throw new T05Closed('VERSION_CONFLICT');
      await refuseActive(client,row.root_id);await readCurrentOwnerConfirmation(client,row,this.options.proof);
      if(row.status!=='PENDING_IDENTITY'&&row.identity_status!=='CONFIRMED')throw new T05Closed('IDENTITY_NOT_READY');
      return row.status==='PENDING_IDENTITY'&&row.identity_status!=='CONFIRMED';
    });
    return this.grantCommand(request,id,'issue');
  }
  async revoke(request:T05CommandRequest,id:string){return this.grantCommand(request,id,'revoke');}
  private async grantCommand(request:T05CommandRequest,id:string,action:'issue'|'revoke'){
    const bodyHash=t05Hash(JSON.stringify({invitationId:id,action}));
    const reservePlan=ownerInvitationPlan<Readonly<{row:Awaited<ReturnType<typeof requireInvitation>>;previous:GrantCommand|null;complete:boolean}>>(id,'initialize-pending');
    reservePlan.validate=async(client,principal)=>{
      const row=await requireInvitation(client,id);
      const previous=await readT05Record<GrantCommand>(client,principal.subjectId,operation(action,'command'),request.key,bodyHash);
      if(previous)return Object.freeze({row:Object.freeze(row),previous:Object.freeze(validCommand(previous)),complete:Boolean(await readT05Record(client,principal.subjectId,operation(action,'complete'),request.key,bodyHash))});
      if(row.status==='REVOKED')throw new T05Closed('VERSION_CONFLICT');
      await refuseActive(client,row.root_id);
      if(request.version===undefined||request.version!==BigInt(row.version))throw new T05Closed('VERSION_CONFLICT');
      await readCurrentOwnerConfirmation(client,row,this.options.proof);
      if(action==='issue'&&row.identity_status!=='CONFIRMED')throw new T05Closed('IDENTITY_NOT_READY');
      return Object.freeze({row:Object.freeze(row),previous:null,complete:false});
    };
    const reserved=await this.options.auth.withT05Session(request.cookie,mutation(request),reservePlan,async(client,principal,locked,{row,previous,complete})=>{
      if(previous)return {command:previous,complete,view:invitationView(row)};
      const authority=locked.authorities.get(row.subject_id)!;
      const head=await this.options.journal.head(row.subject_id);
      if(head&&(head.epoch!==BigInt(authority.identity_epoch)||head.hash!==authority.journal_hash||head.sequence!==BigInt(authority.journal_sequence)||head.state!==authority.status))throw new T05Closed('DEPENDENCY_UNAVAILABLE');
      if(!head&&(action==='issue'||authority.journal_sequence!=='0'))throw new T05Closed('IDENTITY_NOT_READY');
      const reset=action==='revoke'||row.status!=='PENDING_IDENTITY'||authority.status!=='PENDING';
      const command:GrantCommand={commandId:randomUUID(),sourceVersion:row.version,version:(BigInt(row.version)+1n).toString(),
        epoch:(BigInt(authority.identity_epoch)+(reset?1n:0n)).toString(),reset,action};
      await putT05Record(client,principal.subjectId,operation(action,'command'),request.key,bodyHash,row.root_id,command);
      return {command,complete:false,view:invitationView(row)};
    });
    if(reserved.complete)return reserved.view; // Current authorization before replay; stale If-Match is ignored.
    const executePlan=ownerInvitationPlan<Readonly<{row:Awaited<ReturnType<typeof requireInvitation>>;complete:boolean}>>(id);
    executePlan.validate=async(client,principal)=>{
      const row=await requireInvitation(client,id);
      if(await readT05Record(client,principal.subjectId,operation(action,'complete'),request.key,bodyHash))return Object.freeze({row:Object.freeze(row),complete:true});
      if(row.status==='REVOKED'||row.version!==reserved.command.sourceVersion)throw new T05Closed('VERSION_CONFLICT');
      await refuseActive(client,row.root_id);await readCurrentOwnerConfirmation(client,row,this.options.proof);
      return Object.freeze({row:Object.freeze(row),complete:false});
    };
    return this.options.auth.withT05Session(request.cookie,mutation(request),executePlan,async(client,principal,locked,{row,complete})=>{
      const command=reserved.command;
      if(complete)return invitationView(row);
      const authority=locked.authorities.get(row.subject_id)!;
      const current=await this.options.journal.head(row.subject_id);
      if(command.reset){
        if(BigInt(authority.identity_epoch)>BigInt(command.epoch))throw new T05Closed('DEPENDENCY_UNAVAILABLE');
        const replay=current?.commandId===command.commandId&&current.epoch===BigInt(command.epoch)&&current.state==='PENDING';
        if(!replay&&current&&(current.hash!==authority.journal_hash||current.epoch!==BigInt(authority.identity_epoch)))throw new T05Closed('DEPENDENCY_UNAVAILABLE');
        await client.query('SET LOCAL ROLE control_coordinator');
        const head=replay?current:await this.options.journal.append(client,{subjectId:row.subject_id,commandId:command.commandId,epoch:BigInt(command.epoch),state:'PENDING',actor:{id:principal.subjectId,type:'human'}});
        await client.query(`UPDATE identity.account_authority SET identity_epoch=$2,status='PENDING',confirmed_epoch=NULL,enrollment_status='PENDING',recovery_ready=false,journal_sequence=$3,journal_hash=$4 WHERE subject_id=$1`,[row.subject_id,command.epoch,head.sequence.toString(),head.hash]);
        await client.query('UPDATE identity.session SET revoked_at=now() WHERE subject_id=$1 AND revoked_at IS NULL',[row.subject_id]);
        if(action==='revoke')await client.query("UPDATE identity.membership SET state='DENIED',version=version+1 WHERE subject_id=$1 AND state<>'DENIED'",[row.subject_id]);
        await client.query('SET LOCAL ROLE control_t05');
      }else if(!current||current.state!=='PENDING'||current.epoch!==BigInt(command.epoch)||current.hash!==authority.journal_hash)throw new T05Closed('IDENTITY_NOT_READY');
      let enrollmentUrl:string|undefined;
      if(action==='issue'){
        assertNativeInvitation(await this.options.native.user(row.subject_id),row);
        const token=randomBytes(32).toString('base64url');
        await client.query("UPDATE control.agency_invitation SET status='ISSUED',token_hash=$2,expires_at=$3,version=$4 WHERE id=$1",[row.id,t05Hash(token),new Date(this.now().getTime()+600_000),command.version]);
        enrollmentUrl=this.options.origin+'/enrollment/start#token='+token;
      }else await client.query("UPDATE control.agency_invitation SET status='REVOKED',token_hash=NULL,expires_at=NULL,version=$2 WHERE id=$1",[row.id,command.version]);
      await putT05Record(client,principal.subjectId,operation(action,'complete'),request.key,bodyHash,row.root_id,{completed:true});
      await t05Audit(client,{actor:principal.subjectId,root:row.root_id,type:action==='issue'?'invitation.issued':'invitation.revoked',version:BigInt(command.version),eventId:command.commandId});
      const view=invitationView(await requireInvitation(client,id));
      return enrollmentUrl?{...view,enrollmentUrl}:view;
    });
  }
}
