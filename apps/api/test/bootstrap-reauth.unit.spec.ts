import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { BootstrapReauth } from '@dossiercle/adapters/identity/bootstrap-reauth';
import { BootstrapReauthService } from '../src/auth/bootstrap-reauth.service.js';

function fixture(rows:unknown[][]){
  const query=vi.fn(async()=>({rows:rows.shift()??[]}));
  const pool={query} as never;
  const beginBootstrap=vi.fn(async(subject:string)=>({cookie:'F'.repeat(43),url:new URL('https://localhost:4443/realms/dossiercle/protocol/openid-connect/auth?client_id=s01-bff&login_hint='+subject)}));
  const identity={beginBootstrap,continueBootstrap:vi.fn()} as never;
  const browser={authorizeBootstrap:vi.fn(),closeBootstrap:vi.fn()} as never;
  const native=new BootstrapReauth({decoyKey:Buffer.alloc(32,7)});
  const service=new BootstrapReauthService({pool,native,identity,auth:{} as never,browser,ownerSubject:'00000000-0000-4000-8000-000000000001'});
  return {service,beginBootstrap,browser,query};
}

describe('bootstrap reauthentication lookup boundary',()=>{
  it('validates the pre-auth nonce before any database lookup',async()=>{
    const f=fixture([[]]),context=f.service.context('127.0.0.1');
    await expect(f.service.start({cookie:context.cookie,nonce:'x'.repeat(43),ip:'127.0.0.1',email:'owner@example.invalid'})).rejects.toThrow('BOOTSTRAP_REAUTH_CLOSED');
    expect(f.query).not.toHaveBeenCalled();
    expect(f.beginBootstrap).not.toHaveBeenCalled();
  });

  it('applies the IP start quota before database reads',async()=>{
    const f=fixture(Array.from({length:5},()=>[]));
    for(let index=0;index<5;index++){
      const context=f.service.context('127.0.0.1');
      await f.service.start({cookie:context.cookie,nonce:context.nonce,ip:'127.0.0.1',email:`guest${index}@example.invalid`});
    }
    expect(f.query).toHaveBeenCalledTimes(5);
    const limited=f.service.context('127.0.0.1');
    await expect(f.service.start({cookie:limited.cookie,nonce:limited.nonce,ip:'127.0.0.1',email:'sixth@example.invalid'})).rejects.toThrow('BOOTSTRAP_REAUTH_RATE_LIMITED');
    expect(f.query).toHaveBeenCalledTimes(5);
  });

  it('returns the same public start shape for admitted and unknown selectors',async()=>{
    const owner={subject_id:'00000000-0000-4000-8000-000000000001',root_id:randomUUID(),status:'CLAIMED',identity_status:'CONFIRMED',version:'2',token_hash:null,
      identity_epoch:'1',confirmed_epoch:'1',authority_status:'CONFIRMED',contact:'owner@example.invalid',owner_id:'00000000-0000-4000-8000-000000000001'};
    const known=fixture([[owner]]),unknown=fixture([[]]);
    const knownContext=known.service.context('127.0.0.1'),unknownContext=unknown.service.context('127.0.0.1');
    const knownStart=await known.service.start({cookie:knownContext.cookie,nonce:knownContext.nonce,ip:'127.0.0.1',email:'owner@example.invalid'});
    const unknownStart=await unknown.service.start({cookie:unknownContext.cookie,nonce:unknownContext.nonce,ip:'127.0.0.1',email:'nobody@example.invalid'});
    expect(knownStart).toEqual({continueUrl:'/v1/auth/bootstrap/reauth/continue',flowCookie:'F'.repeat(43)});
    expect(unknownStart).toEqual(knownStart);
    const knownSubject=known.beginBootstrap.mock.calls[0]![0];
    const unknownSubject=unknown.beginBootstrap.mock.calls[0]![0];
    expect(knownSubject).toBe(owner.subject_id);expect(unknownSubject).not.toBe(knownSubject);
    expect(JSON.stringify(unknownStart)).not.toContain('nobody@example.invalid');
  });

  it('admits only a claimed first administrator with the current durable invitation receipt',async()=>{
    const subject=randomUUID(),root=randomUUID(),tokenHash='a'.repeat(64),receipt=randomUUID();
    const invitation={subject_id:subject,root_id:root,status:'CLAIMED',identity_status:'CONFIRMED',version:'4',token_hash:tokenHash,
      identity_epoch:'9',confirmed_epoch:'9',authority_status:'CONFIRMED',contact:'guest@example.invalid',owner_id:randomUUID()};
    const admission={result:{epoch:'9',root,subject,version:'4',tokenHash,admissionReceipt:receipt}};
    const f=fixture([[invitation],[admission]]),context=f.service.context('127.0.0.1');
    await f.service.start({cookie:context.cookie,nonce:context.nonce,ip:'127.0.0.1',email:'guest@example.invalid'});
    expect(f.beginBootstrap.mock.calls[0]![0]).toBe(subject);
  });
});
