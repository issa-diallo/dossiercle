import { createHash, randomBytes } from 'node:crypto';
import type { EnrollmentGrant } from './enrollment-coordinator.js';
import type { KeycloakAdapter } from './keycloak-adapter.js';
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
interface Flow {cookieHash:string;grant:EnrollmentGrant;verifier:string;state:string;nonce:string;expires:number}
interface BootstrapFlow {cookieHash:string;subject:string;verifier:string;state:string;nonce:string;expires:number;url:URL}
/** Ephemeral Code state: server-only verifier/nonce, single use even after failed exchange. */
export class OidcFlow {
  private readonly flows=new Map<string,Flow>();
  private readonly bootstrapFlows=new Map<string,BootstrapFlow>();
  constructor(private readonly options:{adapter:Pick<KeycloakAdapter,'begin'|'exchange'>;origin:string;now?:()=>number}){}
  private now(){return this.options.now?.()??Date.now();}
  async begin(grant:EnrollmentGrant){
    for(const [key,value] of this.flows)if(value.expires<=this.now())this.flows.delete(key);
    if(grant.expires<=this.now()||this.flows.size>=100)throw new Error('IDENTITY_NOT_READY');
    const cookie=randomBytes(32).toString('base64url');
    const native=await this.options.adapter.begin(this.options.origin+'/v1/auth/oidc/callback',grant.subject);
    const expires=Math.min(grant.expires,this.now()+600_000);
    if(expires<=this.now())throw new Error('IDENTITY_NOT_READY');
    this.flows.set(hash(native.state),{cookieHash:hash(cookie),grant,verifier:native.verifier,state:native.state,nonce:native.nonce,expires});
    return {cookie,url:native.url};
  }
  /** Independent, one-use OIDC flow. It cannot be consumed as an enrollment grant. */
  async beginBootstrap(subject:string){
    for(const [key,value] of this.bootstrapFlows)if(value.expires<=this.now())this.bootstrapFlows.delete(key);
    if(!/^[0-9a-f-]{36}$/.test(subject)||this.bootstrapFlows.size>=100)throw new Error('IDENTITY_NOT_READY');
    const native=await this.options.adapter.begin(this.options.origin+'/v1/auth/bootstrap/reauth/callback',subject);
    const cookie=randomBytes(32).toString('base64url'),expires=this.now()+300_000;
    this.bootstrapFlows.set(hash(native.state),{cookieHash:hash(cookie),subject,verifier:native.verifier,state:native.state,nonce:native.nonce,expires,url:native.url});
    return {cookie,url:native.url};
  }
  continueBootstrap(cookie:string){
    const flow=[...this.bootstrapFlows.values()].find(value=>value.cookieHash===hash(cookie)&&value.expires>this.now());
    if(!flow)throw new Error('IDENTITY_NOT_READY');return flow.url;
  }
  private bootstrapCallbackFlow(cookie:string,url:URL){
    if(url.origin!==this.options.origin||url.pathname!=='/v1/auth/bootstrap/reauth/callback'||url.hash||url.username||url.password)throw new Error('IDENTITY_NOT_READY');
    for(const key of url.searchParams.keys())if(!['code','state','session_state','iss'].includes(key)||url.searchParams.getAll(key).length!==1)throw new Error('IDENTITY_NOT_READY');
    const state=url.searchParams.get('state'),code=url.searchParams.get('code');
    if(!state||state.length>256||!code||code.length>4096||! /^[A-Za-z0-9_-]{43}$/.test(cookie))throw new Error('IDENTITY_NOT_READY');
    const key=hash(state),flow=this.bootstrapFlows.get(key);
    if(!flow||flow.cookieHash!==hash(cookie)||flow.expires<=this.now())throw new Error('IDENTITY_NOT_READY');
    return {key,flow};
  }
  preflightBootstrap(cookie:string,url:URL){this.bootstrapCallbackFlow(cookie,url);}
  async completeBootstrap(cookie:string,url:URL){
    const {key,flow}=this.bootstrapCallbackFlow(cookie,url);
    this.bootstrapFlows.delete(key);
    try{
      const result=await this.options.adapter.exchange(url,{verifier:flow.verifier,state:flow.state,nonce:flow.nonce});
      if(result.subject!==flow.subject||result.acr!=='2'||!result.sid||flow.expires<=this.now())throw new Error('IDENTITY_NOT_READY');
      return {...result,expectedSubject:flow.subject};
    }catch(error){throw new Error('IDENTITY_NOT_READY',{cause:error});}
  }
  /** Reject unbound callback syntax/state before any durable journal mutation. */
  preflight(cookie:string,url:URL){this.callbackFlow(cookie,url);}
  private callbackFlow(cookie:string,url:URL){
    if(url.origin!==this.options.origin||url.pathname!=='/v1/auth/oidc/callback'||url.hash||url.username||url.password)throw new Error('IDENTITY_NOT_READY');
    for(const key of url.searchParams.keys())if(!['code','state','session_state','iss'].includes(key)||url.searchParams.getAll(key).length!==1)throw new Error('IDENTITY_NOT_READY');
    const state=url.searchParams.get('state'),code=url.searchParams.get('code');
    if(!state||state.length>256||!code||code.length>4096||! /^[A-Za-z0-9_-]{43}$/.test(cookie))throw new Error('IDENTITY_NOT_READY');
    const key=hash(state),flow=this.flows.get(key);
    if(!flow||flow.cookieHash!==hash(cookie)||flow.expires<=this.now())throw new Error('IDENTITY_NOT_READY');
    return {key,flow};
  }
  /** Invoked while the coordinator retains current invitation/authority locks. */
  async complete(cookie:string,url:URL){
    const {key,flow}=this.callbackFlow(cookie,url);
    this.flows.delete(key);
    try {
      const result=await this.options.adapter.exchange(url,{verifier:flow.verifier,state:flow.state,nonce:flow.nonce});
      if(result.subject!==flow.grant.subject||!result.sid||flow.expires<=this.now())throw new Error('IDENTITY_NOT_READY');
      return {grant:flow.grant,...result};
    }catch(error){throw new Error('IDENTITY_NOT_READY',{cause:error});}
  }
}
