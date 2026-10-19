import { NativeIdentityMismatch, type KeycloakAdapter } from '@dossiercle/adapters/identity/keycloak-adapter';
import type { EnrollmentAdapter } from '@dossiercle/adapters/identity/enrollment-adapter';
import type { EnrollmentCoordinator } from '@dossiercle/adapters/identity/enrollment-coordinator';
import type { OidcFlow } from '@dossiercle/adapters/identity/oidc-flow';
import type { BootstrapReauth } from '@dossiercle/adapters/identity/bootstrap-reauth';
import { NativeIdentityChanged, NativeSessionEnded, type AuthService } from './auth.service.js';
import { randomUUID } from 'node:crypto';
import { writeAudit } from '@dossiercle/adapters/audit/audit-writer';
/** Private coordinator orchestration; no native administration or keys are passed to browser. */
export class IdentityCoordinator {
  constructor(private readonly options:{keycloak:KeycloakAdapter;pi:EnrollmentAdapter;enrollment:EnrollmentCoordinator;flow:OidcFlow;auth:AuthService;ownerSubject:string;issuer:string;bootstrapReauth?:BootstrapReauth}){}
  async beginBootstrap(subject:string){return await this.options.flow.beginBootstrap(subject);}
  continueBootstrap(cookie:string){return this.options.flow.continueBootstrap(cookie);}
  preflightBootstrap(cookie:string,url:URL){this.options.flow.preflightBootstrap(cookie,url);}
  async callbackBootstrap(cookie:string,flowCookie:string,url:URL,previousCookie?:string){
    this.options.flow.preflightBootstrap(flowCookie,url);
    const context=this.options.bootstrapReauth?.peek(cookie);
    if(!context)throw new Error('IDENTITY_NOT_READY');
    if(!context.actor){
      await this.options.flow.completeBootstrap(flowCookie,url);
      this.options.bootstrapReauth?.take(cookie,flowCookie);
      throw new Error('IDENTITY_NOT_READY');
    }
    const selected=context.actor;
    return await this.options.auth.withBootstrap(selected,async(client,contact)=>{
      const native=await this.options.flow.completeBootstrap(flowCookie,url);
      const actor=this.options.bootstrapReauth?.take(cookie,flowCookie);
      if(!actor?.actor||actor.actor.subject!==native.subject||actor.subject!==native.subject||native.expectedSubject!==native.subject)throw new Error('IDENTITY_NOT_READY');
      if(native.issuer!==this.options.issuer||native.acr!=='2'||!await this.options.keycloak.sessionPresent(native.subject,native.sid))throw new Error('IDENTITY_NOT_READY');
      const user=await this.options.keycloak.user(native.subject);
      if(!user.enabled||user.id!==selected.subject||user.username!==selected.subject||user.invitationRoot!==selected.root||user.contact!==contact)throw new Error('IDENTITY_NOT_READY');
      const credentials=await this.options.keycloak.credentialReadiness(selected.subject);
      const proof=await this.options.pi.proof(selected.subject,selected.subject);
      if(!credentials.passwordConfigured||!credentials.recoveryReady||!proof.enrollmentVerified)throw new Error('IDENTITY_NOT_READY');
      const nativePayload={sid:native.sid,acr:native.acr,issuer:native.issuer,root:selected.root,contact,
        credentialFingerprint:credentials.fingerprint,piFingerprint:proof.fingerprint,tokens:native.tokens};
      const session=await this.options.auth.issue(client,{subjectId:selected.subject,rootId:selected.root,epoch:selected.epoch,
        scope:selected.scope,nativePayload,...(previousCookie?{replaceCookie:previousCookie}:{}),...(selected.scope==='onboarding'&&selected.tokenHash&&selected.admissionReceipt
          ?{receipt:{version:selected.version,tokenHash:selected.tokenHash,admissionReceipt:selected.admissionReceipt}}:{})});
      const eventId=randomUUID();
      await writeAudit(client,{eventId,agencyId:null,actorId:selected.subject,actorType:'human',eventType:'identity.bootstrap-reauth.succeeded.v1',
        resourceId:selected.root,version:selected.epoch,outcome:'succeeded',correlation:eventId,dispatch:false},'control_audit');
      return session;
    });
  }
  async begin(grantCookie:string){
    return await this.options.enrollment.withGrant(grantCookie,{mutation:false},async grant=>({value:await this.options.flow.begin(grant)}));
  }
  async callback(grantCookie:string,flowCookie:string,url:URL){
    this.options.flow.preflight(flowCookie,url);
    return await this.options.enrollment.confirm(grantCookie,async(grant,expected)=>{
      const result=await this.options.flow.complete(flowCookie,url);
      if(result.grant.subject!==grant.subject||result.grant.root!==grant.root||result.grant.epoch!==grant.epoch||result.grant.version!==grant.version)throw new Error('IDENTITY_NOT_READY');
      const user=await this.options.keycloak.user(result.subject);
      if(!user.enabled||user.username!==grant.subject||user.invitationRoot!==grant.root||user.contact!==expected.contact)throw new Error('IDENTITY_NOT_READY');
      const credentials=await this.options.keycloak.credentialReadiness(grant.subject);
      const pi=await this.options.pi.proof(grant.subject,grant.subject);
      if(!result.sid||!await this.options.keycloak.sessionPresent(grant.subject,result.sid))throw new Error('IDENTITY_NOT_READY');
      return {subject:result.subject,sid:result.sid,passwordConfigured:credentials.passwordConfigured,recoveryReady:credentials.recoveryReady,enrollmentVerified:pi.enrollmentVerified,
        nativePayload:{sid:result.sid,acr:result.acr,issuer:result.issuer,root:grant.root,contact:expected.contact,credentialFingerprint:credentials.fingerprint,piFingerprint:pi.fingerprint,tokens:result.tokens}};
    },async(client,grant,nativePayload)=>await this.options.auth.issue(client,{subjectId:grant.subject,rootId:grant.root,epoch:grant.epoch,
      scope:grant.subject===this.options.ownerSubject?'platform':'onboarding',nativePayload,
      ...(grant.tokenHash&&grant.admissionReceipt?{receipt:{version:grant.version,tokenHash:grant.tokenHash,admissionReceipt:grant.admissionReceipt}}:{})}));
  }
  async verifySession(subject:string,payload:Record<string,unknown>){
    await this.verifyIdentity(subject,payload);
    if(!await this.options.keycloak.sessionPresent(subject,payload['sid'] as string))throw new NativeSessionEnded();
  }
  async verifyIdentity(subject:string,payload:Record<string,unknown>){
    if(typeof payload['sid']!=='string'||payload['acr']!=='2'||payload['issuer']!==this.options.issuer||typeof payload['root']!=='string'||typeof payload['contact']!=='string'
      ||typeof payload['credentialFingerprint']!=='string'||typeof payload['piFingerprint']!=='string')throw new Error('IDENTITY_NOT_READY');
    let user;
    try{user=await this.options.keycloak.user(subject);}catch(error){
      if(error instanceof NativeIdentityMismatch)throw new NativeIdentityChanged();
      throw error;
    }
    if(user.id!==subject||!user.enabled||user.username!==subject||user.invitationRoot!==payload['root']||user.contact!==payload['contact'])throw new NativeIdentityChanged();
    let credentials;
    try{credentials=await this.options.keycloak.credentialReadiness(subject);}catch(error){
      if(error instanceof NativeIdentityMismatch)throw new NativeIdentityChanged();
      throw error;
    }
    let pi;
    try{pi=await this.options.pi.proof(subject,subject);}catch(error){
      if(error instanceof Error&&error.message==='IDENTITY_NOT_READY')throw new NativeIdentityChanged();
      throw error;
    }
    if(!credentials.passwordConfigured||!credentials.recoveryReady||credentials.fingerprint!==payload['credentialFingerprint']||pi.fingerprint!==payload['piFingerprint'])throw new NativeIdentityChanged();
  }
}
