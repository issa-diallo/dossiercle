import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { BootstrapReauth } from '../src/identity/bootstrap-reauth.js';
import { OidcFlow } from '../src/identity/oidc-flow.js';
import type { KeycloakAdapter } from '../src/identity/keycloak-adapter.js';

describe('bootstrap reauth protocol composition (mock OIDC transport; not native MFA evidence)',()=>{
  it('binds a known actor to a fixed bootstrap callback and yields only that subject after OIDC proof',async()=>{
    const origin='https://localhost:4443',subject=randomUUID(),actor={subject,root:randomUUID(),epoch:2n,scope:'onboarding' as const,version:'3',tokenHash:'a'.repeat(64),admissionReceipt:randomUUID()};
    const native=new BootstrapReauth({decoyKey:Buffer.alloc(32,4)}),context=native.createContext('127.0.0.1');
    const selected=native.begin({cookie:context.cookie,nonce:context.nonce,ip:'127.0.0.1',email:'guest@example.invalid',actor});
    let redirect='';
    const adapter={begin:async(uri:string)=>{redirect=uri;return {url:new URL(origin+'/realms/dossiercle/protocol/openid-connect/auth?state=s&code_challenge=x'),state:'S'.repeat(43),nonce:'N'.repeat(43),verifier:'V'.repeat(43)};},
      exchange:async()=>({subject,sid:randomUUID(),acr:'2',issuer:origin+'/realms/dossiercle',tokens:{}})} as unknown as Pick<KeycloakAdapter,'begin'|'exchange'>;
    const flow=new OidcFlow({adapter,origin}),started=await flow.beginBootstrap(selected.subject);
    native.bindFlow(context.cookie,started.cookie);
    expect(redirect).toBe(origin+'/v1/auth/bootstrap/reauth/callback');
    expect(flow.continueBootstrap(started.cookie).pathname).toBe('/realms/dossiercle/protocol/openid-connect/auth');
    const url=new URL(origin+'/v1/auth/bootstrap/reauth/callback?code=opaque-code&state='+encodeURIComponent('S'.repeat(43)));
    const result=await flow.completeBootstrap(started.cookie,url);
    expect(result.expectedSubject).toBe(subject);
    expect(native.take(context.cookie,started.cookie).actor).toEqual(actor);
    await expect(flow.completeBootstrap(started.cookie,url)).rejects.toThrow('IDENTITY_NOT_READY');
  });

  it('keeps a stable non-authorizing decoy and consumes a mismatched native subject once',async()=>{
    const origin='https://localhost:4443',native=new BootstrapReauth({decoyKey:Buffer.alloc(32,5)}),context=native.createContext('127.0.0.1');
    const selected=native.begin({cookie:context.cookie,nonce:context.nonce,ip:'127.0.0.1',email:'unknown@example.invalid',actor:null});
    let exchanges=0;const adapter={begin:async()=>({url:new URL(origin+'/native'),state:'state',nonce:'nonce',verifier:'verifier'}),exchange:async()=>{exchanges++;return {subject:randomUUID(),sid:randomUUID(),acr:'2',issuer:origin+'/realms/dossiercle',tokens:{}};}} as unknown as Pick<KeycloakAdapter,'begin'|'exchange'>;
    const flow=new OidcFlow({adapter,origin}),started=await flow.beginBootstrap(selected.subject);native.bindFlow(context.cookie,started.cookie);
    const url=new URL(origin+'/v1/auth/bootstrap/reauth/callback?code=code&state=state');
    await expect(flow.completeBootstrap(started.cookie,url)).rejects.toThrow('IDENTITY_NOT_READY');
    await expect(flow.completeBootstrap(started.cookie,url)).rejects.toThrow('IDENTITY_NOT_READY');
    expect(exchanges).toBe(1);expect(native.decoy('unknown@example.invalid')).toBe(selected.subject);
    expect(native.take(context.cookie,started.cookie).actor).toBeNull();
  });
});
