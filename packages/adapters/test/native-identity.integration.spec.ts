import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import https from 'node:https';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import { BackchannelAdapter } from '../src/identity/backchannel-adapter.js';
import { KeycloakAdapter, NativeIdentityMismatch } from '../src/identity/keycloak-adapter.js';
import { EnrollmentAdapter } from '../src/identity/enrollment-adapter.js';
import { nativeTransport } from '../src/identity/native-transport.js';
const state = JSON.parse(await readFile('.local/environment.json', 'utf8')) as {root:string;private:string;project:string;tlsPort:number;syntheticOnly:boolean};
if (!state.syntheticOnly || state.root !== process.cwd()) throw new Error('SYNTHETIC_REQUIRED');
async function address(service:string) {
  const result=await promisify(execFile)('docker',['inspect','--format','{{json .NetworkSettings.Networks}}',state.project+'-'+service+'-1']);
  const networks=JSON.parse(result.stdout) as Record<string,{IPAddress:string}>;
  const value=networks[state.project+'_private']?.IPAddress;if(!value)throw new Error('PRIVATE_SERVICE_REQUIRED');return value;
}
const origin='https://localhost:'+state.tlsPort;
const callbackOrigin='https://localhost:'+state.tlsPort;
const kcTransport={advertisedOrigin:origin,host:await address('keycloak'),port:8443,serverName:'keycloak',caFile:state.private+'/ca/ca.crt'};
const adapter=new KeycloakAdapter({transport:kcTransport,callbackOrigin,realm:'dossiercle',clientId:'s01-bff',clientSecret:(await readFile(state.private+'/kc/client-s01-bff','utf8')).trim(),administrativeClientId:'s01-identity',administrativeSecret:(await readFile(state.private+'/kc/client-s01-identity','utf8')).trim(),importClientId:'s01-importer',importSecret:(await readFile(state.private+'/kc/client-s01-importer','utf8')).trim()});
const piOptions={transport:{advertisedOrigin:'https://privacyidea:8443',host:await address('privacyidea'),port:8443,serverName:'privacyidea',caFile:state.private+'/ca/ca.crt'},verifierPassword:(await readFile(state.private+'/pi/verifier-password','utf8')).trim()};
const pi=new EnrollmentAdapter(piOptions);
describe('native identity configuration only; no MFA or agency qualification',()=>{
 it('reads back native password→MFA order, evaluated LOA2, brute-force and session bounds',async()=>{
  const fetch=nativeTransport(kcTransport);
  const auth=await fetch(origin+'/realms/master/protocol/openid-connect/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:'s01-bootstrap',client_secret:(await readFile(state.private+'/kc/bootstrap-client-secret','utf8')).trim()})});
  if(!auth.ok)throw new Error('SYNTHETIC_NATIVE_READBACK_CLOSED');
  const token=(await auth.json() as {access_token:string}).access_token;
  const get=async(path:string)=>{
   const result=await fetch(origin+'/admin/realms/dossiercle'+path,{headers:{Authorization:'Bearer '+token}});
   if(!result.ok)throw new Error('SYNTHETIC_NATIVE_READBACK_CLOSED');return await result.json() as unknown;
  };
  const realm=await get('') as Record<string,unknown>;
  expect({flow:realm['browserFlow'],password:realm['passwordPolicy'],brute:realm['bruteForceProtected'],failures:realm['failureFactor'],wait:realm['maxFailureWaitSeconds'],idle:realm['ssoSessionIdleTimeout'],absolute:realm['ssoSessionMaxLifespan']}).toEqual({flow:'s01-browser-v2',password:'length(12)',brute:true,failures:5,wait:900,idle:1800,absolute:1296000});
  const clients=await get('/clients') as Array<{clientId:string;enabled:boolean;bearerOnly?:boolean;standardFlowEnabled?:boolean;directAccessGrantsEnabled?:boolean;implicitFlowEnabled?:boolean;optionalClientScopes?:string[];defaultClientScopes?:string[];attributes?:Record<string,string>}>;
  expect(clients.find(c=>c.clientId==='account')?.enabled).toBe(false);
  expect(clients.find(c=>c.clientId==='account-console')?.enabled).toBe(false);
  for(const client of clients.filter(c=>c.enabled&&c.bearerOnly!==true)){
    expect(client.directAccessGrantsEnabled===true,client.clientId).toBe(false);
    expect(client.implicitFlowEnabled===true).toBe(false);
    expect(client.standardFlowEnabled===true&&client.bearerOnly!==true,client.clientId).toBe(client.clientId==='s01-bff');
    expect([...(client.optionalClientScopes??[]),...(client.defaultClientScopes??[])].includes('offline_access')).toBe(false);
  }
  expect(clients.find(c=>c.clientId==='realm-management')?.bearerOnly).toBe(true);
  expect(clients.filter(c=>c.enabled&&c.bearerOnly===true).map(c=>c.clientId).every(id=>['realm-management','broker'].includes(id))).toBe(true);
  expect(await get('/identity-provider/instances')).toEqual([]);
  expect(realm['directGrantFlow']).toBe('s01-closed');expect(realm['resetCredentialsFlow']).toBe('s01-closed');
  expect(realm['registrationAllowed']).toBe(false);expect(realm['resetPasswordAllowed']).toBe(false);
  const actions=await get('/authentication/required-actions') as Array<{alias:string;enabled:boolean}>;
  expect(actions.find(a=>a.alias==='CONFIGURE_TOTP')?.enabled).toBe(false);
  const children=async(alias:string)=>(await get('/authentication/flows/'+alias+'/executions') as Array<{level:number;providerId?:string;displayName:string;requirement:string;authenticationConfig?:string}>).filter(e=>e.level===0);
  const root=await children('s01-browser-v2');expect(root.map(e=>({provider:e.providerId??e.displayName,requirement:e.requirement}))).toEqual([{provider:'auth-username-password-form',requirement:'REQUIRED'},{provider:'s01-mfa-v2',requirement:'REQUIRED'}]);
  const mfa=await children('s01-mfa-v2');expect(mfa.map(e=>({name:e.displayName,requirement:e.requirement}))).toEqual([{name:'s01-loa2-v2',requirement:'CONDITIONAL'}]);
  const loa=await children('s01-loa2-v2');expect(loa[0]?.providerId).toBe('conditional-level-of-authentication');
  const config=await get('/authentication/config/'+loa[0]!.authenticationConfig) as {config:Record<string,string>};
  expect({level:config.config['loa-condition-level'],maxAge:config.config['loa-max-age']}).toEqual({level:'2',maxAge:'0'});
 });
 it('distinguishes a positively absent native subject from temporary native transport failure',async()=>{
  await expect(adapter.user(randomUUID())).rejects.toBeInstanceOf(NativeIdentityMismatch);
 });
 it('requires a fixed destination and verifies TLS identity',async()=>{
  await expect(nativeTransport(kcTransport)('https://example.invalid/')).rejects.toThrow('NATIVE_DESTINATION_REJECTED');
  const bad=nativeTransport({...kcTransport,serverName:'example.invalid'});
  await expect(bad(origin+'/realms/dossiercle/.well-known/openid-configuration')).rejects.toThrow('DEPENDENCY_UNAVAILABLE');
 });
 it('enforces a total deadline even while a TLS peer trickles bytes',async()=>{
  const server=https.createServer({key:await readFile(state.private+'/kc-tls/server.key'),cert:await readFile(state.private+'/kc-tls/server.crt')},(_request,response)=>{
    response.writeHead(200,{'Content-Type':'application/json'});response.write('{');
    const trickle=setInterval(()=>response.write(' '),20);response.on('close',()=>clearInterval(trickle));
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();if(!address||typeof address==='string')throw new Error('SYNTHETIC_LISTENER_UNAVAILABLE');
  const fetch=nativeTransport({...kcTransport,host:'127.0.0.1',port:address.port,deadlineMs:150});
  const start=performance.now();
  try { await expect(fetch(origin+'/probe')).rejects.toThrow('DEPENDENCY_UNAVAILABLE');expect(performance.now()-start<1000).toBe(true); }
  finally { await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve())); }
 });
 it('discovers the exact real issuer and starts Code+PKCE with required LOA2',async()=>{
  const configuration=await adapter.oidcConfiguration();expect(configuration.serverMetadata().issuer).toBe(origin+'/realms/dossiercle');
  const flow=await adapter.begin(callbackOrigin+'/v1/auth/oidc/callback');
  expect(flow.url.searchParams.get('response_type')).toBe('code');expect(flow.url.searchParams.get('code_challenge_method')).toBe('S256');
  expect(flow.url.searchParams.get('acr_values')).toBe('2');expect(flow.url.searchParams.get('scope')).toBe('openid');
  expect(flow.url.searchParams.get('state')===flow.state).toBe(true);expect(flow.url.searchParams.get('nonce')===flow.nonce).toBe(true);
  await expect(adapter.begin('https://example.invalid/callback')).rejects.toThrow('INVALID_REDIRECT');
 });
 it('rejects a real native service token as a logout token and rejects malformed tokens',async()=>{
  const verifier=new BackchannelAdapter({transport:kcTransport,clientId:'s01-bff'});
  const response=await nativeTransport(kcTransport)(origin+'/realms/dossiercle/protocol/openid-connect/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:'s01-resolver',client_secret:(await readFile(state.private+'/kc/client-s01-resolver','utf8')).trim()})});
  expect(response.status).toBe(200);const native=await response.json() as {access_token:string};
  await expect(verifier.verify(native.access_token)).rejects.toThrow('INVALID_LOGOUT_TOKEN');
  await expect(verifier.verify('forged')).rejects.toThrow('INVALID_LOGOUT_TOKEN');
 });
 it('creates native account without password and reconciles only matching immutable root/contact',async()=>{
  const root=randomUUID(), username=randomUUID(), subject=randomUUID(); const contact=username+'@example.invalid';
  const user=await adapter.createUser(subject,username,contact,root);
  expect(user.id).toBe(subject);expect(user.username).toBe(username);expect(user.invitationRoot).toBe(root);
  expect(await adapter.createUser(subject,username,contact,root)).toEqual(user);
  await expect(adapter.createUser(subject,username,'other@example.invalid',root)).rejects.toThrow('IDENTITY_NOT_READY');
  await expect(adapter.createUser(subject,username,contact,randomUUID())).rejects.toThrow('IDENTITY_NOT_READY');
  expect(await adapter.credentialReadiness(user.id)).toMatchObject({passwordConfigured:false,recoveryReady:false});
  const fetch=nativeTransport(piOptions.transport);
  const login=await fetch('https://privacyidea:8443/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'s01-verifier',password:piOptions.verifierPassword})});
  expect(login.status).toBe(200);
  const a=await login.json() as {result:{status:boolean;value:{token:string}}};expect(a.result.status).toBe(true);
  const q=new URLSearchParams({user:username,userid:user.id,realm:'dossiercle',resolver:'s01-keycloak',type:'totp',pagesize:'2'});
  const listed=await fetch('https://privacyidea:8443/token/?'+q,{headers:{'PI-Authorization':a.result.value.token}});
  expect(listed.status).toBe(200);
  const l=await listed.json() as {result:{status:boolean;error?:{code:number};value:unknown}};expect(l.result.status).toBe(true);
  await expect(pi.proof(user.id,username)).rejects.toThrow('IDENTITY_NOT_READY');
  // No session, native password, OTP, recovery or business permission created here.
 });
});
