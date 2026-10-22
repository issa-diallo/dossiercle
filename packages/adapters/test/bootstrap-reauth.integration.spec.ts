import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import https from 'node:https';
import { readFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { BootstrapReauth } from '../src/identity/bootstrap-reauth.js';
import { OidcFlow } from '../src/identity/oidc-flow.js';
import type { KeycloakAdapter } from '../src/identity/keycloak-adapter.js';
import { KeycloakBrowserProxy } from '../src/identity/keycloak-browser-proxy.js';
import { nativeTransport } from '../src/identity/native-transport.js';

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

describe('bootstrap reauth real TLS proxy boundary (not native MFA evidence)',()=>{
  let server:https.Server,origin:string,privatePath:string,requests=0;
  const subject=randomUUID(),cookie='B'.repeat(43);
  beforeAll(async()=>{
    const env=JSON.parse(await readFile('.local/environment.json','utf8')) as {private:string;syntheticOnly:boolean;root:string};
    if(!env.syntheticOnly||env.root!==process.cwd())throw new Error('SYNTHETIC_REQUIRED');
    privatePath=env.private;
    server=https.createServer({key:await readFile(privatePath+'/ingress-tls/server.key'),cert:await readFile(privatePath+'/ingress-tls/server.crt')},(request,response)=>{
      requests++;
      const url=new URL(request.url!,origin);
      if(url.pathname==='/redirect'){
        response.writeHead(303,{Location:url.searchParams.get('target')!});response.end();return;
      }
      if(request.method==='GET'){
        response.writeHead(200,{'Content-Type':'text/html','Set-Cookie':'AUTH_SESSION_ID=synthetic-native-cookie; Secure; HttpOnly; Path=/'});
        response.end('<form action="'+origin+'/realms/dossiercle/login-actions/authenticate?session_code=synthetic-once"></form>');return;
      }
      if(request.headers.cookie!=='AUTH_SESSION_ID=synthetic-native-cookie'){response.writeHead(403);response.end();return;}
      response.writeHead(303,{Location:origin+'/v1/auth/bootstrap/reauth/callback?state=synthetic-state&code=synthetic-code',
        'Set-Cookie':'KEYCLOAK_IDENTITY=synthetic-native-identity; Secure; HttpOnly; Path=/'});response.end();
    });
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
    origin='https://localhost:'+(server.address() as AddressInfo).port;
  });
  afterAll(async()=>{if(server)await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));});
  function proxy(){
    const transport={advertisedOrigin:origin,host:'127.0.0.1',port:(server.address() as AddressInfo).port,serverName:'localhost',caFile:privatePath+'/ca/ca.crt'};
    const boundary=new KeycloakBrowserProxy({origin,transport,enrollment:{} as never,keycloak:{} as never,
      bootstrap:{withNative:async<T>(_cookie:string,work:(selected:string)=>Promise<T>)=>await work(subject)}});
    const url=new URL(origin+'/realms/dossiercle/protocol/openid-connect/auth?client_id=s01-bff');
    boundary.authorizeBootstrap(cookie,url);return {boundary,url,transport};
  }
  it('keeps native cookies in the server jar and accepts only the emitted action once',async()=>{
    const {boundary,url}=proxy();
    const first=await boundary.request({bootstrapCookie:cookie,method:'GET',path:url.pathname+url.search});
    expect(first.status).toBe(200);expect(first.headers.getSetCookie()).toEqual([]);
    const action='/realms/dossiercle/login-actions/authenticate?session_code=synthetic-once';
    const result=await boundary.request({bootstrapCookie:cookie,method:'POST',path:action,origin,contentType:'application/x-www-form-urlencoded',body:'username='+subject});
    expect(result.status).toBe(303);expect(result.headers.get('location')).toContain('/v1/auth/bootstrap/reauth/callback?');
    expect(result.headers.getSetCookie()).toEqual([]);
    await expect(boundary.request({bootstrapCookie:cookie,method:'POST',path:action,origin,contentType:'application/x-www-form-urlencoded',body:'username='+subject})).rejects.toThrow('BROWSER_ACTION_NOT_EMITTED');
  });
  it('rejects a different technical username before forwarding credentials',async()=>{
    const {boundary,url}=proxy();await boundary.request({bootstrapCookie:cookie,method:'GET',path:url.pathname+url.search});
    const before=requests;
    await expect(boundary.request({bootstrapCookie:cookie,method:'POST',path:'/realms/dossiercle/login-actions/authenticate?session_code=synthetic-once',origin,
      contentType:'application/x-www-form-urlencoded',body:'username='+randomUUID()})).rejects.toThrow('INVITATION_UNAVAILABLE');
    expect(requests).toBe(before);
  });
  it('allows the exact same-origin callback and refuses suffixes and foreign origins over real TLS',async()=>{
    const {transport}=proxy(),fetch=nativeTransport({...transport,browserRedirects:true});
    const target=origin+'/v1/auth/bootstrap/reauth/callback?code=synthetic';
    expect((await fetch(origin+'/redirect?target='+encodeURIComponent(target))).status).toBe(303);
    for(const invalid of [origin+'/v1/auth/bootstrap/reauth/callback/extra','https://external.example.invalid/v1/auth/bootstrap/reauth/callback']){
      await expect(fetch(origin+'/redirect?target='+encodeURIComponent(invalid))).rejects.toThrow('NATIVE_REDIRECT_REJECTED');
    }
  });
});
