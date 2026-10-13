import { describe,it,expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { OidcFlow } from '../src/identity/oidc-flow.js';
import type { KeycloakAdapter } from '../src/identity/keycloak-adapter.js';
const origin='https://127.0.0.1:49401';
const subject=randomUUID();
const grant=()=>({subject,root:randomUUID(),version:'1',epoch:1n,expires:Date.now()+600000});
function fixture(){let exchanges=0;let fail=false;let exchangedSubject=subject;
 const adapter={begin:async()=>({url:new URL(origin+'/native'),state:'synthetic-state',nonce:'synthetic-nonce',verifier:'synthetic-verifier'}),exchange:async()=>{
  exchanges++;if(fail)throw new Error('SYNTHETIC_UPSTREAM');return {subject:exchangedSubject,sid:randomUUID(),tokens:{}};
 }} as unknown as Pick<KeycloakAdapter,'begin'|'exchange'>;
 return {flow:new OidcFlow({adapter,origin}),get exchanges(){return exchanges;},fail:()=>{fail=true;},foreign:()=>{exchangedSubject=randomUUID();}};
}
const callback=()=>new URL(origin+'/v1/auth/oidc/callback?code=synthetic-code&state=synthetic-state');
describe('OIDC one-use state primitives only; no native MFA qualification',()=>{
 it('requires the opaque browser flow cookie and consumes a valid callback once',async()=>{
  const f=fixture(),begun=await f.flow.begin(grant());
  await expect(f.flow.complete('x'.repeat(43),callback())).rejects.toThrow('IDENTITY_NOT_READY');expect(f.exchanges).toBe(0);
  expect((await f.flow.complete(begun.cookie,callback())).subject).toBe(subject);
  await expect(f.flow.complete(begun.cookie,callback())).rejects.toThrow('IDENTITY_NOT_READY');expect(f.exchanges).toBe(1);
 });
 it('never retries native exchange after failed exchange or foreign subject',async()=>{
  for(const failure of ['native','subject']){const f=fixture(),b=await f.flow.begin(grant());if(failure==='native')f.fail();else f.foreign();
   await expect(f.flow.complete(b.cookie,callback())).rejects.toThrow('IDENTITY_NOT_READY');
   await expect(f.flow.complete(b.cookie,callback())).rejects.toThrow('IDENTITY_NOT_READY');expect(f.exchanges).toBe(1);
  }
 });
 it('rejects duplicate parameters, foreign callback and expires before exchange',async()=>{
  const f=fixture(),b=await f.flow.begin(grant());
  const duplicate=callback();duplicate.searchParams.append('code','duplicate');
  await expect(f.flow.complete(b.cookie,duplicate)).rejects.toThrow('IDENTITY_NOT_READY');
  await expect(f.flow.complete(b.cookie,new URL('https://example.invalid/v1/auth/oidc/callback?code=x&state=synthetic-state'))).rejects.toThrow('IDENTITY_NOT_READY');
  await expect(f.flow.begin({...grant(),expires:Date.now()-1})).rejects.toThrow('IDENTITY_NOT_READY');expect(f.exchanges).toBe(0);
 });
 it('restart loses all flows and cannot resurrect a callback',async()=>{
  const f=fixture(),b=await f.flow.begin(grant()),restarted=fixture();
  await expect(restarted.flow.complete(b.cookie,callback())).rejects.toThrow('IDENTITY_NOT_READY');expect(restarted.exchanges).toBe(0);
 });
});
