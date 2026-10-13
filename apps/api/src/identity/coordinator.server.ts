import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { Request, Response, NextFunction } from 'express';
import type { ArgumentsHost } from '@nestjs/common';
import { AppModule } from '../app.module.js';
import { readFileSync } from 'node:fs';
import { randomUUID,createHash } from 'node:crypto';
import { controlPool } from '@dossiercle/adapters/postgres/runtime-pool';
import { AuthorityJournal } from '@dossiercle/adapters/journal/authority-journal';
import { EnrollmentCoordinator } from '@dossiercle/adapters/identity/enrollment-coordinator';
import { EnrollmentProxy } from '@dossiercle/adapters/identity/enrollment-proxy';
import { KeycloakBrowserProxy } from '@dossiercle/adapters/identity/keycloak-browser-proxy';
import { opaqueCookie } from '../auth/auth.service.js';
import { AuthService } from '../auth/auth.service.js';
import { IdentityCoordinator } from '../auth/identity-coordinator.js';
import { ControlRepository } from '@dossiercle/adapters/postgres/control.repository';
import { KeycloakAdapter } from '@dossiercle/adapters/identity/keycloak-adapter';
import { EnrollmentAdapter } from '@dossiercle/adapters/identity/enrollment-adapter';
import { OidcFlow } from '@dossiercle/adapters/identity/oidc-flow';
import { SessionCipher } from '@dossiercle/adapters/identity/session-cipher';
import { UUID } from '@dossiercle/contracts';
import { BackchannelAdapter } from '@dossiercle/adapters/identity/backchannel-adapter';
export interface Configuration {syntheticOnly:true;origin:string;issuer:string;ownerSubject:string;pgHost:string;pgPort:number;pgPasswordFile:string;caFile:string;clientCertificateFile:string;clientKeyFile:string;certificateFile:string;keyFile:string;journalDirectory:string;keycloakBffSecretFile:string;keycloakIdentitySecretFile:string;keycloakImportSecretFile:string;piVerifierPasswordFile:string;sessionEncryptionKeyFile:string;sessionCsrfKeyFile:string}
const COOKIE='__Host-s01-enrollment';
/** Synthetic candidate only. Starts no business API and exposes no administrative endpoint. */
export async function startCoordinator(config:Configuration){
  if(config.syntheticOnly!==true||config.issuer!==config.origin||!/^https:\/\/localhost:[0-9]+$/.test(config.origin)||config.pgHost!=='postgres'||config.pgPort!==5432)throw new Error('SYNTHETIC_REQUIRED');
  UUID.parse(config.ownerSubject);
  const pool=controlPool({host:config.pgHost,port:config.pgPort,role:'control_coordinator',password:readFileSync(config.pgPasswordFile,'utf8').trim(),max:2});
  const journal=new AuthorityJournal(config.journalDirectory);
  await journal.initializeSynthetic();
  const coordinator=new EnrollmentCoordinator({pool,journal,origin:config.origin});
  const control=new ControlRepository(pool,journal);
  const transport={advertisedOrigin:config.issuer,host:'keycloak',port:8443,serverName:'keycloak',caFile:config.caFile};
  const keycloak=new KeycloakAdapter({transport,callbackOrigin:config.origin,realm:'dossiercle',clientId:'s01-bff',
    clientSecret:readFileSync(config.keycloakBffSecretFile,'utf8').trim(),administrativeClientId:'s01-identity',
    administrativeSecret:readFileSync(config.keycloakIdentitySecretFile,'utf8').trim(),importClientId:'s01-importer',
    importSecret:readFileSync(config.keycloakImportSecretFile,'utf8').trim()});
  const pi=new EnrollmentAdapter({transport:{advertisedOrigin:'https://privacyidea:8443',host:'privacyidea',port:8443,
    serverName:'privacyidea',caFile:config.caFile},verifierPassword:readFileSync(config.piVerifierPasswordFile,'utf8').trim()});
  const cipher=new SessionCipher(readFileSync(config.sessionEncryptionKeyFile),readFileSync(config.sessionCsrfKeyFile));
  const flow=new OidcFlow({adapter:keycloak,origin:config.origin});
  let verifyNativeSession:(subject:string,payload:Record<string,unknown>)=>Promise<void>=async()=>{throw new Error('IDENTITY_NOT_READY');};
  let verifyNativeIdentity:(subject:string,payload:Record<string,unknown>)=>Promise<void>=async()=>{throw new Error('IDENTITY_NOT_READY');};
  const auth=new AuthService({pool,control,cipher,journal,ownerSubject:config.ownerSubject,origin:config.origin,
    nativeRefresh:async(subject,payload)=>await keycloak.refreshSession(subject,payload),nativeSession:async(subject,payload)=>await verifyNativeSession(subject,payload),nativeIdentity:async(subject,payload)=>await verifyNativeIdentity(subject,payload)});
  const identity=new IdentityCoordinator({keycloak,pi,enrollment:coordinator,flow,auth,ownerSubject:config.ownerSubject,issuer:config.issuer+'/realms/dossiercle'});
  const browserProxy=new KeycloakBrowserProxy({origin:config.origin,enrollment:coordinator,keycloak,transport});
  verifyNativeSession=async(subject,payload)=>await identity.verifySession(subject,payload);
  verifyNativeIdentity=async(subject,payload)=>await identity.verifyIdentity(subject,payload);
  const backchannel=new BackchannelAdapter({transport,clientId:'s01-bff'});
  const proxy=new EnrollmentProxy(coordinator,{advertisedOrigin:'https://localhost:9443',host:'ingress',port:9443,serverName:'localhost',caFile:config.caFile,
    clientCertificateFile:config.clientCertificateFile,clientKeyFile:config.clientKeyFile});
  const script=`(()=>{const token=new URLSearchParams(location.hash.slice(1)).get('token');history.replaceState(null,'','/enrollment/start');if(!token){document.getElementById('status').textContent='Invitation indisponible. Contactez le propriétaire.';return;}fetch('/enrollment/grant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token}),credentials:'same-origin'}).then(r=>{if(!r.ok)throw Error();location.replace('/');}).catch(()=>document.getElementById('status').textContent='Invitation indisponible. Contactez le propriétaire.');})();`;
  const scriptHash=createHash('sha256').update(script).digest('base64');
  const httpsOptions={key:readFileSync(config.keyFile),cert:readFileSync(config.certificateFile),minVersion:'TLSv1.2' as const};
  const app=await NestFactory.create(AppModule.registerAuth({auth,identity,browser:browserProxy,origin:config.origin,backchannel}),{logger:false,bodyParser:false,httpsOptions});
  app.useGlobalFilters({catch(error:unknown,host:ArgumentsHost){
    const code=error instanceof Error&&'code' in error?String(error.code):error instanceof Error?error.message:'UNAUTHENTICATED';
    const status=code==='FORBIDDEN'||code==='AUTHORITY_DENIED'||code==='INVITATION_UNAVAILABLE'?403:code==='AUTHORITY_UNAVAILABLE'||code==='DEPENDENCY_UNAVAILABLE'?503:401;
    host.switchToHttp().getResponse<Response>().status(status).json({code:status===503?'DEPENDENCY_UNAVAILABLE':status===403?'FORBIDDEN':'UNAUTHENTICATED',correlationId:randomUUID(),retryable:status===503});
  }});
  app.use(async(request:Request,response:Response,next:NextFunction)=>{
    response.setHeader('Cache-Control','no-store');response.setHeader('Referrer-Policy','no-referrer');response.setHeader('X-Content-Type-Options','nosniff');
    try {
      if(request.method==='POST'&&request.url==='/v1/auth/backchannel'&&['identity-coordinator:4001',new URL(config.origin).host].includes(request.headers.host??'')){next();return;}
      if(request.headers.host!==new URL(config.origin).host)throw new Error('INVITATION_UNAVAILABLE');
      const path=request.url??'';
      const pathname=new URL(path,config.origin).pathname;
      if(['/v1/auth/oidc/start','/v1/auth/oidc/callback','/v1/session','/v1/auth/logout'].includes(pathname)){next();return;}
      if(request.method==='GET'&&path==='/enrollment/start'){
        response.setHeader('Content-Security-Policy',`default-src 'none';script-src 'sha256-${scriptHash}';connect-src 'self';base-uri 'none';frame-ancestors 'none'`);
        response.setHeader('Content-Type','text/html; charset=utf-8');response.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Enrôlement sécurisé</title><h1>Préparer votre accès</h1><p id="status" role="status">Vérification de votre invitation…</p><script>${script}</script></html>`);return;
      }
      if(request.method==='GET'&&path==='/health'){response.end('synthetic identity coordinator');return;}
      const parts:Buffer[]=[];let length=0;
      for await(const part of request){length+=Buffer.byteLength(part);if(length>32768)throw new Error('INVITATION_UNAVAILABLE');parts.push(Buffer.from(part));}
      const body=Buffer.concat(parts).toString('utf8');
      const origin=request.headers.origin;
      const cookie=request.headers.cookie;
      if(path.startsWith('/realms/')||path.startsWith('/resources/')) {
        let grantCookie:string|undefined;try{grantCookie=opaqueCookie(cookie,COOKIE);}catch{/* Public metadata/resources need no grant. */}
        const native=await browserProxy.request({path,method:request.method??'',...(grantCookie?{grantCookie}:{}),...(cookie?{cookie}:{}),
          ...(origin?{origin}:{}),...(request.headers['content-type']?{contentType:request.headers['content-type']}:{}) ,...(body?{body}:{})});
        response.statusCode=native.status;
        // Classical native forms need a non-null Origin; send origin only, never action URLs or keys.
        if(path.startsWith('/realms/'))response.setHeader('Referrer-Policy','strict-origin');
        for(const name of ['content-type','content-security-policy','location']){const value=native.headers.get(name);if(value)response.setHeader(name,value);}
        const cookies=native.headers.getSetCookie();if(cookies.length)response.setHeader('Set-Cookie',cookies);
        response.end(Buffer.from(await native.arrayBuffer()));return;
      }
      if(request.method==='POST'&&path==='/v1/auth/enrollment/actions'){
        const jwt=request.headers['pi-authorization'];
        if(typeof jwt!=='string'||body!=='{}'||request.headers['content-type']!=='application/json')throw new Error('INVITATION_UNAVAILABLE');
        await coordinator.withGrant(opaqueCookie(cookie,COOKIE),{mutation:true,...(origin?{origin}:{}),nativeJwt:jwt},async(grant)=>{
          await keycloak.sendNativeRequiredActions(grant.subject);return {value:undefined};
        });
        response.statusCode=204;response.end();return;
      }
      if(request.method==='GET'&&path==='/v1/auth/enrollment/complete'){
        await coordinator.withGrant(opaqueCookie(cookie,COOKIE),{mutation:false},async()=>({value:undefined}));
        response.statusCode=303;response.setHeader('Location','/v1/auth/oidc/start');response.end();return;
      }
      if(request.method==='POST'&&path==='/enrollment/grant'){
        if(origin!==config.origin||request.headers['content-type']!=='application/json')throw new Error('INVITATION_UNAVAILABLE');
        const data=JSON.parse(body) as unknown;
        if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).length!==1||!('token' in data)||typeof data.token!=='string')throw new Error('INVITATION_UNAVAILABLE');
        const admitted=await coordinator.admit(data.token);
        // Native Keycloak/PI and callback share a fixed TLS origin; no cross-host grant handoff.
        // Mutations remain guarded by exact Origin in EnrollmentCoordinator.withGrant.
        response.setHeader('Set-Cookie',`${COOKIE}=${admitted.cookie}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`);
        response.statusCode=204;response.end();return;
      }
      const jwt=request.headers['pi-authorization'];if(Array.isArray(jwt))throw new Error('INVITATION_UNAVAILABLE');
      const native=await proxy.request({cookie:opaqueCookie(request.headers.cookie,COOKIE),method:request.method??'',path,
        ...(origin?{origin}:{}),...(jwt?{jwt}:{}),...(request.headers['content-type']?{contentType:request.headers['content-type']}:{}) ,...(body?{body}:{})});
      response.statusCode=native.status;
      const contentType=native.headers.get('content-type');if(contentType)response.setHeader('Content-Type',contentType);
      // Native previous UI needs inline Angular bootstrap; all network access stays on this origin.
      response.setHeader('Content-Security-Policy',"default-src 'self';script-src 'self' 'unsafe-inline' 'unsafe-eval';style-src 'self' 'unsafe-inline';img-src 'self' data:;connect-src 'self';object-src 'none';base-uri 'self';frame-ancestors 'none';form-action 'self'");
      response.end(Buffer.from(await native.arrayBuffer()));
    }catch{
      if(!response.headersSent){response.statusCode=403;response.setHeader('Content-Type','application/json');response.end(JSON.stringify({code:'INVITATION_UNAVAILABLE',correlationId:randomUUID(),retryable:false}));}
      else response.destroy();
    }
  });
  const server=app.getHttpServer();
  server.requestTimeout=15000;server.headersTimeout=10000;server.maxHeadersCount=64;
  await app.listen(4001,'0.0.0.0');
  const stop=()=>{void app.close().then(()=>pool.end()).then(()=>process.exit(0));};process.once('SIGTERM',stop);process.once('SIGINT',stop);
  return server;
}
if(import.meta.url===`file://${process.argv[1]}`){
  const config=JSON.parse(readFileSync('/run/s01-coordinator-config/config.json','utf8')) as Configuration;
  try{await startCoordinator(config);}catch{process.stderr.write('IDENTITY_COORDINATOR_CLOSED\n');process.exitCode=1;}
}
