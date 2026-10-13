import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { AuthorityJournal } from '../src/journal/authority-journal.js';
import { EnrollmentCoordinator } from '../src/identity/enrollment-coordinator.js';
import { EnrollmentProxy } from '../src/identity/enrollment-proxy.js';
import { KeycloakAdapter } from '../src/identity/keycloak-adapter.js';
import { nativeTransport } from '../src/identity/native-transport.js';
const e=JSON.parse(await readFile('.local/environment.json','utf8')) as {root:string;private:string;pgPort:number;tlsPort:number;project:string;syntheticOnly:boolean};
if(!e.syntheticOnly||e.root!==process.cwd())throw new Error('SYNTHETIC_REQUIRED');
async function address(service:string){const r=await promisify(execFile)('docker',['inspect','--format','{{json .NetworkSettings.Networks}}',e.project+'-'+service+'-1']);return (JSON.parse(r.stdout) as Record<string,{IPAddress:string}>)[e.project+'_private']!.IPAddress;}
const secret=async(p:string)=>(await readFile(e.private+'/'+p,'utf8')).trim();
const origin='https://localhost:'+e.tlsPort;
const transport={advertisedOrigin:'https://localhost:9443',host:await address('ingress'),port:9443,serverName:'localhost',caFile:e.private+'/ca/ca.crt'};
const trusted={...transport,clientCertificateFile:e.private+'/coordinator-tls/client.crt',clientKeyFile:e.private+'/coordinator-tls/client.key'};
const kc=new KeycloakAdapter({transport:{advertisedOrigin:'https://localhost:'+e.tlsPort,host:await address('keycloak'),port:8443,serverName:'keycloak',caFile:transport.caFile},callbackOrigin:origin,realm:'dossiercle',clientId:'s01-bff',clientSecret:await secret('kc/client-s01-bff'),administrativeClientId:'s01-identity',administrativeSecret:await secret('kc/client-s01-identity'),importClientId:'s01-importer',importSecret:await secret('kc/client-s01-importer')});
const pool=new Pool({host:'127.0.0.1',port:e.pgPort,database:'control',user:'control_coordinator',password:await secret('pg/control_coordinator'),max:2});
const api=new Pool({host:'127.0.0.1',port:e.pgPort,database:'control',user:'control_api',password:await secret('pg/control_api'),max:2});
const journal=new AuthorityJournal('.local/journal/tests-native-enrollment');
beforeAll(()=>journal.initializeSynthetic());afterAll(async()=>{await pool.end();await api.end();});
describe('native remote-user bridge; no completed MFA or business access',()=>{
 it('rejects native bridge without its dedicated coordinator certificate',async()=>{
  const response=await nativeTransport(transport)(transport.advertisedOrigin+'/auth',{method:'POST',headers:{'X-S01-Native-User':randomUUID()+'@dossiercle','Content-Type':'application/json'},body:'{}'});
  expect(response.status===400||response.status===403).toBe(true);
 });
 it('serves unchanged native UI, mints bound user JWT and starts native TOTP verification',async()=>{
  const subject=randomUUID(),root=randomUUID(),token=randomBytes(32).toString('base64url'),command=randomUUID();
  const c=await pool.connect();try{
   await c.query('BEGIN');await c.query('INSERT INTO identity.account_authority(subject_id) VALUES($1)',[subject]);
   const head=await journal.append(c,{subjectId:subject,commandId:command,epoch:1n,state:'PENDING'});
   await kc.createUser(subject,subject,subject+'@example.invalid',root);
   await c.query('UPDATE identity.account_authority SET journal_sequence=$2,journal_hash=$3 WHERE subject_id=$1',[subject,head.sequence.toString(),head.hash]);await c.query('COMMIT');
  }finally{c.release();}
  await api.query(`INSERT INTO control.agency_invitation(id,root_id,subject_id,contact,owner_id,identity_status,status,token_hash,expires_at)
   VALUES($1,$2,$3,$4,$5,'CONFIRMED','ISSUED',$6,now()+interval '10 minutes')`,[randomUUID(),root,subject,subject+'@example.invalid',randomUUID(),createHash('sha256').update(token).digest('hex')]);
  const coor=new EnrollmentCoordinator({pool,journal,origin}),g=await coor.admit(token),proxy=new EnrollmentProxy(coor,trusted);
  const before=await journal.head(subject);
  for(const query of ['otpkey=forged','keysize=1','serial=foreign','timeWindow=999','2stepinit=1','type=totp&type=hotp']){
    await expect(proxy.request({cookie:g.cookie,method:'POST',path:'/token/init?'+query,origin,contentType:'application/json',body:'{"type":"totp","genkey":1}'})).rejects.toThrow('INVITATION_UNAVAILABLE');
  }
  for(const path of ['/token/../auth','/%2e%2e/auth','//auth'])await expect(proxy.request({cookie:g.cookie,method:'POST',path,origin,contentType:'application/json',body:'{}'})).rejects.toThrow('INVITATION_UNAVAILABLE');
  for(const override of [{timeWindow:999},{timeStep:86400},{otplen:1},{hashlib:'invalid'},{genkey:0},{otpkey:'forged'},{keysize:1},{type:'hotp'},{serial:'foreign',verify:'123456',genkey:1}]){
    await expect(proxy.request({cookie:g.cookie,method:'POST',path:'/token/init',origin,contentType:'application/json',body:JSON.stringify({type:'totp',genkey:1,...override})})).rejects.toThrow('INVITATION_UNAVAILABLE');
  }
  expect((await journal.head(subject))?.hash===before?.hash).toBe(true);
  const page=await proxy.request({cookie:g.cookie,method:'GET',path:'/'});
  expect(page.status).toBe(200);expect((await page.text()).includes('id=REMOTE_USER value="'+subject+'@dossiercle"')).toBe(true);
  const auth=await proxy.request({cookie:g.cookie,method:'POST',path:'/auth',origin,contentType:'application/json',body:JSON.stringify({username:subject+'@dossiercle',password:'',realm:'dossiercle'})});
  expect(auth.status).toBe(200);const result=await auth.json() as {result:{value:{token:string}}};const jwt=result.result.value.token;
  const init=await proxy.request({cookie:g.cookie,method:'POST',path:'/token/init',origin,jwt,contentType:'application/json',body:JSON.stringify({type:'totp',genkey:1,otpkey:null,user:subject,realm:'dossiercle'})});
  expect(init.status).toBe(200);const enrolled=await init.json() as {result:{status:boolean};detail?:{serial?:string;googleurl?:{value?:string}}};
  expect(enrolled.result.status).toBe(true);expect(typeof enrolled.detail?.serial==='string').toBe(true);
  const listed=await nativeTransport(trusted)(trusted.advertisedOrigin+'/token/',{headers:{'X-S01-Native-User':subject+'@dossiercle','PI-Authorization':jwt}});
  const tokenState=await listed.json() as {result:{value:{tokens:Array<{otplen:number;info:{timeStep:string;timeWindow:string;hashlib:string};rollout_state:string}>}}};
  const nativeToken=tokenState.result.value.tokens[0];
  expect(nativeToken?.otplen===6&&String(nativeToken.info.timeStep)==='30'&&String(nativeToken.info.timeWindow)==='60'&&nativeToken.info.hashlib==='sha1'&&nativeToken.rollout_state==='verify').toBe(true);
  let active=0,maxActive=0,nativeCommands=0;
  await Promise.all([0,1].map(async()=>await coor.withGrant(g.cookie,{mutation:true,origin,nativeJwt:jwt},async(grant,lease)=>{
    await lease.check();active++;maxActive=Math.max(maxActive,active);
    try{await kc.sendNativeRequiredActions(grant.subject);nativeCommands++;await lease.check();return {value:undefined};}finally{active--;}
  })));
  expect({nativeCommands,maxActive}).toEqual({nativeCommands:2,maxActive:1});
  // Sensitive native enrollment response stays in memory. No OTP is computed by the application.
  expect((await pool.query('SELECT status,enrollment_status FROM identity.account_authority WHERE subject_id=$1',[subject])).rows[0]).toEqual({status:'PENDING',enrollment_status:'PENDING'});
  await expect(proxy.request({cookie:g.cookie,method:'POST',path:'/token/init',origin,jwt,contentType:'application/json',body:JSON.stringify({type:'hotp'})})).rejects.toThrow('INVITATION_UNAVAILABLE');
 });
});
