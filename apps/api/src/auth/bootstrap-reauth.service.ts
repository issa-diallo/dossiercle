import type { Pool } from '@dossiercle/adapters/postgres/runtime-pool';
import { BootstrapReauth, type BootstrapActor } from '@dossiercle/adapters/identity/bootstrap-reauth';
import type { IdentityCoordinator } from './identity-coordinator.js';
import type { AuthService } from './auth.service.js';
import type { KeycloakBrowserProxy } from '@dossiercle/adapters/identity/keycloak-browser-proxy';

type Admission={epoch?:string;root?:string;subject?:string;version?:string;tokenHash?:string;admissionReceipt?:string};
type InvitationCandidate={subject_id:string;root_id:string;status:string;identity_status:string;version:string;token_hash:string|null;identity_epoch:string;confirmed_epoch:string|null;authority_status:string;contact:string;owner_id:string;admission:Admission|null};
class BootstrapSelectorCollision extends Error {}

/** HTTP orchestration for the isolated bootstrap reauthentication ceremony. */
export class BootstrapReauthService {
  constructor(private readonly options:{pool:Pool;native:BootstrapReauth;identity:IdentityCoordinator;auth:AuthService;browser:KeycloakBrowserProxy;ownerSubject:string}){}
  context(ip:string,cookie?:string){if(cookie)this.options.browser.closeBootstrap(cookie);return this.options.native.createContext(ip,cookie);}
  async start(input:{cookie:string;nonce:string;ip:string;email:string}){
    const prepared=this.options.native.prepare(input);
    const email=prepared.email;
    let actor:BootstrapActor|null=null;
    try{actor=await this.resolve(email);}catch(error){
      if(error instanceof BootstrapSelectorCollision){this.options.native.close(input.cookie);throw new Error('BOOTSTRAP_REAUTH_CLOSED');}
      // A failed local lookup never selects an account or publishes diagnostics.
    }
    const started=this.options.native.begin({...input,email,actor});
    const flow=await this.options.identity.beginBootstrap(started.subject);
    this.options.native.bindFlow(input.cookie,flow.cookie);
    this.options.browser.authorizeBootstrap(input.cookie,flow.url);
    return {continueUrl:'/v1/auth/bootstrap/reauth/continue',flowCookie:flow.cookie};
  }
  continue(cookie:string){return this.options.identity.continueBootstrap(cookie);}
  async callback(cookie:string,flowCookie:string,url:URL,previousCookie?:string){
    this.options.native.peek(cookie);
    try{return await this.options.identity.callbackBootstrap(cookie,flowCookie,url,previousCookie);}
    catch{await this.options.auth.auditBootstrapFailure();throw new Error('BOOTSTRAP_REAUTH_CLOSED');}
    finally{this.options.native.close(cookie);this.options.browser.closeBootstrap(cookie);}
  }
  close(cookie:string){this.options.native.close(cookie);}
  async withNative<T>(cookie:string,work:(subject:string)=>Promise<T>):Promise<T>{
    const context=this.options.native.peek(cookie);
    if(!context.actor)return await work(context.subject);
    return await this.options.auth.withBootstrap(context.actor,async()=>await work(context.subject));
  }
  private async resolve(email:string):Promise<BootstrapActor|null>{
    const collision=(await this.options.pool.query<{decoy_collision:boolean}>(
      'SELECT EXISTS(SELECT 1 FROM identity.account_authority WHERE subject_id=$1) AS decoy_collision',[this.options.native.decoy(email)])).rows[0];
    if(collision?.decoy_collision)throw new BootstrapSelectorCollision();
    const rows=(await this.options.pool.query<InvitationCandidate>(`SELECT i.subject_id,i.root_id,i.status,i.identity_status,i.version,i.token_hash,i.contact,i.owner_id,
        a.identity_epoch,a.confirmed_epoch,a.status AS authority_status,r.result AS admission
      FROM control.agency_invitation i JOIN identity.account_authority a ON a.subject_id=i.subject_id
      LEFT JOIN control.idempotency_record r ON r.actor_id=i.subject_id AND r.operation_type='identity.enrollment.grant.'||i.version AND r.key=i.root_id
      LEFT JOIN control.agency b ON b.invitation_root_id=i.root_id
      LEFT JOIN identity.membership m ON m.agency_id=b.id AND m.subject_id=i.subject_id
      WHERE i.contact=$1 AND i.identity_status='CONFIRMED' AND (i.status='CLAIMED' OR (i.status='ISSUED' AND i.expires_at>now()))
        AND a.status='CONFIRMED' AND a.confirmed_epoch=a.identity_epoch
        AND ((i.subject_id=$2 AND i.owner_id=$2) OR b.id IS NULL OR (m.role='ADMIN' AND m.state=CASE WHEN b.state='ACTIVE' THEN 'ACTIVE' ELSE 'PENDING' END))
      ORDER BY i.root_id LIMIT 2`,[email,this.options.ownerSubject])).rows;
    if(rows.length!==1)return null;
    const row=rows[0]!;
    const actorBase={subject:row.subject_id,root:row.root_id,epoch:BigInt(row.identity_epoch),version:row.version};
    if(row.subject_id===this.options.ownerSubject&&row.owner_id===this.options.ownerSubject)return {...actorBase,scope:'platform'};
    if(row.subject_id===this.options.ownerSubject||!row.token_hash)return null;
    const value=row.admission;
    if(!value)return null;
    if(value.epoch!==row.identity_epoch||value.root!==row.root_id||value.subject!==row.subject_id||value.version!==row.version
      ||value.tokenHash!==row.token_hash||typeof value.admissionReceipt!=='string')return null;
    return {...actorBase,scope:'onboarding',tokenHash:row.token_hash,admissionReceipt:value.admissionReceipt};
  }
}
