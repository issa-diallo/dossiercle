import type { PoolClient } from '@dossiercle/adapters/postgres/runtime-pool';
import type { SessionPrincipal } from '../auth/auth.service.js';
import type { InvitationRow } from '@dossiercle/adapters/postgres/t05.repository';
import type { KeycloakAdapter } from '@dossiercle/adapters/identity/keycloak-adapter';
import { randomUUID } from 'node:crypto';
import { NativeIdentityMismatch } from '@dossiercle/adapters/identity/keycloak-adapter';
import type { OwnerProofVerifier } from '@dossiercle/adapters/identity/owner-proof';
import { readCurrentOwnerConfirmation } from '@dossiercle/adapters/identity/owner-confirmation';
import type { AuthorityJournal } from '@dossiercle/adapters/journal/authority-journal';
import { putT05Record,readT05Record,requireInvitation,t05Audit,t05Hash,T05Closed } from '@dossiercle/adapters/postgres/t05.repository';
import { mutation,ownerInvitationPlan,type T05CommandRequest,type PrivateAuth } from './t05-context.js';

/** Private read-only guard, executed before any preparation refresh/J1/native effect. */
export type PreparationGuard=(client:PoolClient,principal:SessionPrincipal,row:Readonly<InvitationRow>)=>Promise<boolean>;
export interface PreparationCommand {commandId:string;epoch:string}
export function assertNativeInvitation(user:Awaited<ReturnType<KeycloakAdapter['user']>>,row:{subject_id:string;root_id:string;contact:string}){
  if(user.id!==row.subject_id||user.username!==row.subject_id||user.contact!==row.contact||user.invitationRoot!==row.root_id||!user.enabled)throw new T05Closed('IDENTITY_NOT_READY');
}
export class InvitationPreparationService {
  constructor(private readonly options:{auth:PrivateAuth;proof:OwnerProofVerifier;journal:AuthorityJournal;native:Pick<KeycloakAdapter,'user'|'createUser'>}){}
  async prepare(request:T05CommandRequest,id:string,guard?:PreparationGuard):Promise<boolean>{
    const plan=ownerInvitationPlan<Readonly<{row:Awaited<ReturnType<typeof requireInvitation>>;command:PreparationCommand|null;completed:boolean}>>(id,'initialize-pending');
    plan.validate=async(client,principal)=>{
      const row=await requireInvitation(client,id);
      if(guard&&!await guard(client,principal,row))return Object.freeze({row:Object.freeze(row),command:null,completed:false});
      if(row.status==='REVOKED')return Object.freeze({row:Object.freeze(row),command:null,completed:false});
      await readCurrentOwnerConfirmation(client,row,this.options.proof);
      const command=await readT05Record<PreparationCommand>(client,principal.subjectId,'t05.prepare-command.v1',row.root_id);
      if(!command)throw new T05Closed('IDENTITY_NOT_READY');
      const completed=Boolean(await readT05Record(client,principal.subjectId,'t05.prepare-complete.v1',row.root_id));
      return Object.freeze({row:Object.freeze(row),command:Object.freeze(command),completed});
    };
    return this.options.auth.withT05Session(request.cookie,mutation(request),plan,async(client,principal,locked,{row,command,completed})=>{
      if(!command)return false;
      await client.query('SET LOCAL ROLE control_coordinator');
      if(!completed){
        const authority=locked.authorities.get(row.subject_id)!;
        const head=await this.options.journal.head(row.subject_id);
        if(head&&(head.commandId!==command.commandId||head.epoch!==BigInt(command.epoch)||head.state!=='PENDING'))throw new T05Closed('DEPENDENCY_UNAVAILABLE');
        if(!head&&(authority.status!=='PENDING'||authority.journal_sequence!=='0'||authority.identity_epoch!==command.epoch))throw new T05Closed('DEPENDENCY_UNAVAILABLE');
        const pending=head??await this.options.journal.append(client,{subjectId:row.subject_id,commandId:command.commandId,epoch:BigInt(command.epoch),state:'PENDING',actor:{id:principal.subjectId,type:'human'}});
        await client.query(`UPDATE identity.account_authority SET status='PENDING',identity_epoch=$2,confirmed_epoch=NULL,enrollment_status='PENDING',recovery_ready=false,journal_sequence=$3,journal_hash=$4 WHERE subject_id=$1`,[row.subject_id,command.epoch,pending.sequence.toString(),pending.hash]);
      }
      // Only native errors enter the healthy-PG uncertain branch. SQL errors must roll back.
      try{
        await client.query('SELECT 1');
        let user;
        try{user=await this.options.native.user(row.subject_id);}
        catch(error){if(!(error instanceof NativeIdentityMismatch))throw error;await client.query('SELECT 1');user=await this.options.native.createUser(row.subject_id,row.subject_id,row.contact,row.root_id);}
        assertNativeInvitation(user,row);
        await client.query('SELECT 1');
      }catch{
        await client.query('SELECT 1');
        await client.query("UPDATE control.agency_invitation SET identity_status='PENDING' WHERE id=$1",[row.id]);
        await putT05Record(client,principal.subjectId,'t05.prepare-uncertain.v1',randomUUID(),t05Hash(command.commandId),row.root_id,{prepared:false});
        return false;
      }
      await client.query("UPDATE control.agency_invitation SET identity_status='CONFIRMED' WHERE id=$1",[row.id]);
      if(!completed){
        await putT05Record(client,principal.subjectId,'t05.prepare-complete.v1',row.root_id,t05Hash(command.commandId),row.root_id,{prepared:true});
        await t05Audit(client,{actor:principal.subjectId,root:row.root_id,type:'invitation.identity-prepared',version:BigInt(row.version),eventId:command.commandId,dispatch:false});
      }
      return true;
    });
  }
}
