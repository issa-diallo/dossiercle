import { qualifySyntheticRotation } from '../../packages/adapters/test/private-rotation-fixture.js';
import { qualifyNativeFailures } from './private-fault-fixture.js';
import { triggerSyntheticNativeLogout, setSyntheticNativeEnabled, syntheticNativeFailureStatus, resetSyntheticNativePassword } from '../../packages/adapters/test/private-native-logout-fixture.js';
import { reissueSyntheticEnrollment } from '../../packages/adapters/test/private-control-fixture.js';
import { qualifyConcurrentRecovery } from './private-recovery-fixture.js';
import { fixtureOtp } from './private-otp-fixture.js';
import { test as base, firefox } from '@playwright/test';
import { readFile,mkdir,writeFile,rename } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID,randomBytes,createHash } from 'node:crypto';
import { controlPool } from '../../packages/adapters/dist/postgres/runtime-pool.js';
import { AuthorityJournal } from '../../packages/adapters/dist/journal/authority-journal.js';
import { KeycloakAdapter } from '../../packages/adapters/dist/identity/keycloak-adapter.js';
import { EnrollmentAdapter } from '../../packages/adapters/dist/identity/enrollment-adapter.js';
import { ControlRepository } from '../../packages/adapters/dist/postgres/control.repository.js';
import { SessionCipher } from '../../packages/adapters/dist/identity/session-cipher.js';
import { EnrollmentCoordinator } from '../../packages/adapters/dist/identity/enrollment-coordinator.js';
import { OidcFlow } from '../../packages/adapters/dist/identity/oidc-flow.js';
import { AuthService } from '../../apps/api/src/auth/auth.service.js';
import { IdentityCoordinator } from '../../apps/api/src/auth/identity-coordinator.js';
const e=JSON.parse(await readFile('.local/environment.json','utf8')) as {root:string;private:string;project:string;pgPort:number;tlsPort:number;syntheticOnly:boolean};
if(!e.syntheticOnly||e.root!==process.cwd())throw new Error('SYNTHETIC_REQUIRED');
const origin='https://localhost:'+e.tlsPort;
type NativeAuthPayload={result?:{value?:{token?:string}}};
type NativeInitPayload={result?:{status?:boolean};detail?:{otpkey?:{value_b32?:string};serial?:string}};
type NativeVerifyPayload={result?:{status?:boolean;value?:boolean}};
const run=promisify(execFile);
const secret=async(path:string)=>(await readFile(e.private+'/'+path,'utf8')).trim();
async function address(service:string){const r=await run('docker',['inspect','--format','{{json .NetworkSettings.Networks}}',e.project+'-'+service+'-1']);return (JSON.parse(r.stdout) as Record<string,{IPAddress:string}>)[e.project+'_private']!.IPAddress;}
const test=base.extend({page:async({},use)=>{
 const profile='.local/browser-profiles/'+randomUUID();await mkdir(profile,{recursive:true,mode:0o700});
 await run('certutil',['-N','--empty-password','-d','sql:'+profile]);
 await run('certutil',['-A','-n','s01-synthetic-only','-t','C,,','-i',e.private+'/ca/ca.crt','-d','sql:'+profile]);
 const context=await firefox.launchPersistentContext(profile,{headless:true,ignoreHTTPSErrors:false});
 try{await use(context.pages()[0]??await context.newPage());}finally{await context.close();}
}});
async function nativePendingInvitation(reservedSubject?:string){
 const pool=controlPool({host:'127.0.0.1',port:e.pgPort,role:'control_coordinator',password:await secret('pg/control_coordinator'),max:2});
 const api=controlPool({host:'127.0.0.1',port:e.pgPort,role:'control_api',password:await secret('pg/control_api'),max:2});
 const kc=new KeycloakAdapter({transport:{advertisedOrigin:'https://localhost:'+e.tlsPort,host:await address('keycloak'),port:8443,serverName:'keycloak',caFile:e.private+'/ca/ca.crt'},callbackOrigin:origin,realm:'dossiercle',clientId:'s01-bff',clientSecret:await secret('kc/client-s01-bff'),administrativeClientId:'s01-identity',administrativeSecret:await secret('kc/client-s01-identity'),importClientId:'s01-importer',importSecret:await secret('kc/client-s01-importer')});
 const subject=reservedSubject??randomUUID(),root=randomUUID(),token=randomBytes(32).toString('base64url'),journal=new AuthorityJournal('.local/journal/application');await journal.initializeSynthetic();
 const client=await pool.connect();
 try{
  await client.query('BEGIN');await client.query('INSERT INTO identity.account_authority(subject_id) VALUES($1)',[subject]);
  const head=await journal.append(client,{subjectId:subject,commandId:randomUUID(),epoch:1n,state:'PENDING'});
  await kc.createUser(subject,subject,subject+'@example.invalid',root);
  await client.query('UPDATE identity.account_authority SET journal_sequence=$2,journal_hash=$3 WHERE subject_id=$1',[subject,head.sequence.toString(),head.hash]);await client.query('COMMIT');
  await api.query(`INSERT INTO control.agency_invitation(id,root_id,subject_id,contact,owner_id,identity_status,status,token_hash,expires_at)
    VALUES($1,$2,$3,$4,$5,'CONFIRMED','ISSUED',$6,now()+interval '10 minutes')`,[randomUUID(),root,subject,subject+'@example.invalid',randomUUID(),createHash('sha256').update(token).digest('hex')]);
  return {subject,root,token,contact:subject+'@example.invalid'};
 }finally{client.release();await pool.end();await api.end();}
}
async function nativeKeycloak(){return new KeycloakAdapter({transport:{advertisedOrigin:'https://localhost:'+e.tlsPort,host:await address('keycloak'),port:8443,serverName:'keycloak',caFile:e.private+'/ca/ca.crt'},callbackOrigin:origin,realm:'dossiercle',clientId:'s01-bff',clientSecret:await secret('kc/client-s01-bff'),administrativeClientId:'s01-identity',administrativeSecret:await secret('kc/client-s01-identity'),importClientId:'s01-importer',importSecret:await secret('kc/client-s01-importer')});}
async function qualifyNativeHumanRefresh(cookie:string,csrf:string,kc:KeycloakAdapter){
 const pool=controlPool({host:'127.0.0.1',port:e.pgPort,role:'control_coordinator',password:await secret('pg/control_coordinator'),max:2});
 const journal=new AuthorityJournal('.local/journal/application'),control=new ControlRepository(pool,journal);
 const cipher=new SessionCipher(await readFile(e.private+'/coordinator/session-encryption-key'),await readFile(e.private+'/coordinator/session-csrf-key'));
 const pi=new EnrollmentAdapter({transport:{advertisedOrigin:'https://privacyidea:8443',host:await address('privacyidea'),port:8443,serverName:'privacyidea',caFile:e.private+'/ca/ca.crt'},verifierPassword:await secret('pi/verifier-password')});
 const ownerSubject=(JSON.parse(await readFile(e.private+'/coordinator/config.json','utf8')) as {ownerSubject:string}).ownerSubject;
 const auth=new AuthService({pool,control,journal,cipher,origin,ownerSubject,nativeSession:async(subject,payload)=>await identity.verifySession(subject,payload),nativeRefresh:async(subject,payload)=>await kc.refreshSession(subject,payload)});
 const identity:IdentityCoordinator=new IdentityCoordinator({keycloak:kc,pi,enrollment:new EnrollmentCoordinator({pool,journal,origin}),flow:new OidcFlow({adapter:kc,origin}),auth,ownerSubject,issuer:origin+'/realms/dossiercle'});
 try{await auth.withClaimSession(cookie,{origin,csrf,humanActivity:true},async()=>{});}finally{await pool.end();}
}
async function nativeActionLink(project:string,recipient:string){
 const script=`const h=require('node:http');const get=p=>new Promise((resolve,reject)=>h.get('http://mailpit:8025'+p,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{resolve(JSON.parse(b))}catch{reject(Error())}})}).on('error',reject));(async()=>{const port=process.argv[1],to=process.argv[2],list=await get('/api/v1/messages?start=0&limit=100'),item=list.messages?.find(m=>m.To?.some(x=>x.Address===to));if(!item)throw Error();const detail=await get('/api/v1/message/'+encodeURIComponent(item.ID)),body=String(detail.HTML||'')+' '+String(detail.Text||''),links=[...body.matchAll(/https?:[^\\s<>\"']+/g)].map(x=>x[0].replace(/&amp;/g,'&'));for(const value of links){try{const u=new URL(value);if(u.hostname==='localhost'&&u.port===port&&u.pathname==='/realms/dossiercle/login-actions/action-token'){process.stdout.write(u.href);return}}catch{}}throw Error()})().catch(()=>process.exit(2));`;
 const {stdout}=await run('docker',['exec',project+'-identity-coordinator-1','/s01-node','-e',script,String(e.tlsPort),recipient]);
 const link=stdout.trim();if(!link||link.length>8192)throw new Error('NATIVE_ACTION_LINK_UNAVAILABLE');
 return link;
}
for(const scenario of [{factor:'totp',scope:'onboarding',logout:'local'},{factor:'recovery',scope:'onboarding',logout:'local'},{factor:'totp',scope:'platform',logout:'local'},{factor:'recovery',scope:'onboarding',logout:'backchannel'},{factor:'recovery',scope:'onboarding',logout:'native-change'},{factor:'recovery',scope:'onboarding',logout:'throttle'},{factor:'recovery',scope:'onboarding',logout:'native-password'},{factor:'recovery',scope:'onboarding',logout:'faults'}] as const){
 test('native candidate: '+scenario.factor+' confirms signed LOA2 and '+scenario.scope+' with native refresh/'+scenario.logout,async({page:initialPage})=>{
 let page=initialPage;
 test.setTimeout(600000);
 let stage='invitation';let typeIsTotp=false;let restoreOwner:(()=>Promise<void>)|undefined;let owner:string|undefined;
 let callbackFailure='NOT_SEEN';let nativeFailure='NOT_SEEN';let callbackUrl:string|undefined;
 page.on('response',response=>{const path=new URL(response.url()).pathname;if(path.startsWith('/realms/dossiercle/login-actions/'))nativeFailure=path.split('/').at(-1)+'-'+response.status();});
 page.on('response',response=>{if(new URL(response.url()).pathname==='/v1/auth/oidc/callback'){callbackUrl=response.url();callbackFailure=String(response.status());}});
 page.setDefaultTimeout(10000);
 try{
  if(scenario.scope==='platform'){
    owner=randomUUID();const configPath=e.private+'/coordinator/config.json';const previous=await readFile(configPath,'utf8');
    const writeConfig=async(value:string)=>{const next=configPath+'.test-next';await writeFile(next,value,{flag:'wx',mode:0o400});await rename(next,configPath);await run('docker',['compose','--env-file','.local/compose.env','-f','infra/local/compose.yaml','restart','identity-coordinator']);await run('docker',['compose','--profile','identity-runtime','--env-file','.local/compose.env','-f','infra/local/compose.yaml','up','-d','--wait','--wait-timeout','30','identity-coordinator']);};
    restoreOwner=async()=>await writeConfig(previous);
    const config=JSON.parse(previous) as {syntheticOnly:boolean;ownerSubject:string};if(!config.syntheticOnly)throw new Error('SYNTHETIC_REQUIRED');config.ownerSubject=owner;await writeConfig(JSON.stringify(config));
  }
  const invitation=await nativePendingInvitation(owner);
  stage='grant';
  await page.goto(origin+'/enrollment/start#token='+invitation.token);
  await page.waitForURL(origin+'/');
  await page.waitForFunction(()=>document.querySelector('#REMOTE_USER')!==null);
  const hasIdentity=await page.locator('#REMOTE_USER').evaluate((element)=>Boolean((element as HTMLInputElement).value));
  if(!hasIdentity)throw new Error('NATIVE_IDENTITY_ABSENT');
  stage='native-auth';
  const nativeAuth=page.waitForResponse(r=>r.url()===origin+'/auth'&&r.request().method()==='POST',{timeout:10000}).then(async r=>({status:r.status(),payload:await r.json() as NativeAuthPayload})).catch(()=>({status:0,payload:{} as NativeAuthPayload}));
  await page.locator('button[ng-click="authenticate_remote_user()"]').click();
  const authenticated=await nativeAuth;
  const nativeJwt=authenticated.payload.result?.value?.token;
  if(authenticated.status!==200||!nativeJwt)throw new Error('NATIVE_AUTH_FAILED');
  stage='native-enroll-route';
  await page.locator('a[ui-sref="token.enroll"]').click();
  stage='native-enroll-policy';
  await page.waitForFunction(()=>{const select=document.querySelector<HTMLSelectElement>('#tokentype');return Boolean(select&&select.options[select.selectedIndex]?.textContent?.trim().toLowerCase().startsWith('totp:'));});
  typeIsTotp=await page.locator('#tokentype').evaluate((element)=>((element as HTMLSelectElement).options[(element as HTMLSelectElement).selectedIndex]?.textContent??'').trim().toLowerCase().startsWith('totp:'));
  if(!typeIsTotp)throw new Error('NATIVE_ENROLLMENT_TYPE_NOT_READY');
  stage='native-enroll-submit';
  const initialized=page.waitForResponse(r=>r.url()===origin+'/token/init'&&r.request().method()==='POST',{timeout:10000}).then(async r=>({status:r.status(),payload:await r.json() as NativeInitPayload})).catch(()=>({status:0,payload:{} as NativeInitPayload}));
  await page.locator('button[ng-click="enrollToken()"]').click();
  stage='native-enroll-result';
  const nativeInit=await initialized;

  const seed=nativeInit.payload.detail?.otpkey?.value_b32;
  if(nativeInit.status!==200||nativeInit.payload.result?.status!==true||!seed)throw new Error('NATIVE_ENROLLMENT_FAILED');
  stage='first-otp';
  const enrollmentCounter=Math.floor(Date.now()/30000);
  const firstEnrollmentOtp=await fixtureOtp(seed);
  await page.locator('#verifyResponse').fill(firstEnrollmentOtp);
  const verified=page.waitForResponse(r=>r.url()===origin+'/token/init'&&r.request().method()==='POST',{timeout:10000}).then(async r=>({status:r.status(),payload:await r.json() as NativeVerifyPayload})).catch(()=>({status:0,payload:{} as NativeVerifyPayload}));
  await page.locator('form[ng-submit="sendVerifyResponse()"] button[type="submit"]').click();
  const nativeVerify=await verified;
  if(nativeVerify.status!==200||nativeVerify.payload.result?.status!==true||nativeVerify.payload.result.value!==true)throw new Error('NATIVE_FIRST_OTP_NOT_VERIFIED');
  stage='native-enrollment-proof';
  const pi=new EnrollmentAdapter({transport:{advertisedOrigin:'https://privacyidea:8443',host:await address('privacyidea'),port:8443,serverName:'privacyidea',caFile:e.private+'/ca/ca.crt'},verifierPassword:await secret('pi/verifier-password')});
  const proof=await pi.proof(invitation.subject,invitation.subject);
  if(proof.enrollmentVerified!==true)throw new Error('NATIVE_ENROLLMENT_PROOF_ABSENT');
  stage='native-browser-storage';
  // Browser storage is origin-scoped, so check the PI origin before visiting Keycloak.
  const storageIsEmpty=await page.evaluate(jwt=>![...Object.values(localStorage),...Object.values(sessionStorage)].some(value=>String(value).includes(jwt)),nativeJwt);
  if(!storageIsEmpty)throw new Error('NATIVE_BROWSER_STORAGE_NOT_EMPTY');
  const cleanUrl=page.url().startsWith(origin+'/')&&!page.url().includes(invitation.token);if(!cleanUrl)throw new Error('FRAGMENT_NOT_CLEANED');
  const denied=await page.evaluate(async()=>{const response=await fetch('/token/init?keysize=1',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"type":"totp","genkey":1}'});return response.status===403;});
  if(!denied)throw new Error('QUERY_OVERRIDE_NOT_DENIED');
  stage='native-user-state';
  const kc=await nativeKeycloak();const nativeUser=await kc.user(invitation.subject);
  if(!nativeUser.enabled||nativeUser.contact!==invitation.contact)throw new Error('NATIVE_USER_MISMATCH');
  stage='native-required-action-email';
  const actionsStatus=await page.evaluate(async jwt=>(await fetch('/v1/auth/enrollment/actions',{method:'POST',headers:{'Content-Type':'application/json','PI-Authorization':jwt},body:'{}'})).status,nativeJwt);if(actionsStatus!==204)throw new Error('NATIVE_ACTIONS_NOT_ADMITTED');
  stage='native-action-link';
  const actionLink=await nativeActionLink(e.project,invitation.contact);
  stage='native-action-token-proof';
  try{kc.checkActionTokenClaims(new URL(actionLink).searchParams.get('key')!,invitation.subject);}catch(error){
    const safe=error as {code?:string;claim?:string};stage+='-'+(safe.code??'BOUNDARY')+'-'+(safe.claim??'');throw new Error('NATIVE_ACTION_TOKEN_INVALID');
  }
  stage='native-action-page';
  const actionPage=await page.goto(actionLink);if(!actionPage||actionPage.status()!==200){stage='native-action-page-http'+String(actionPage?.status());throw new Error('NATIVE_ACTION_PAGE_UNAVAILABLE');}
  await page.getByRole('link',{name:/click here to proceed/i}).click();
  stage='native-password-form';
  await page.locator('#password-new').waitFor();
  const password=randomBytes(32).toString('base64url');
  await page.locator('#password-new').fill(password);await page.locator('#password-confirm').fill(password);
  const passwordSubmitted=page.waitForResponse(r=>new URL(r.url()).pathname==='/realms/dossiercle/login-actions/required-action'&&r.request().method()==='POST');
  await page.locator('button[type="submit"],input[type="submit"]').first().click();
  const passwordResponse=await passwordSubmitted;const passwordStatus=passwordResponse.status();if(passwordStatus>=400){stage='native-password-submit-http'+passwordStatus;throw new Error('NATIVE_PASSWORD_MUTATION_FAILED');}
  await page.waitForLoadState('domcontentloaded');
  if(await page.locator('#firstName').count()){
    stage='native-profile-first-name';await page.locator('#firstName').fill('S01');
    stage='native-profile-last-name';await page.locator('#lastName').fill('Synthetic');
    stage='native-profile-submit';
    await page.locator('button[type="submit"],input[type="submit"]').first().click();
  }
  stage='native-recovery-form';
  await page.locator('input[type="checkbox"]').first().waitFor();
  const recoveryCodes=scenario.factor==='recovery'?await page.locator('#kc-recovery-codes-list li').allTextContents():[];
  await page.locator('input[type="checkbox"]').first().check();
  await page.locator('button[type="submit"],input[type="submit"]').last().click();
  const credentials=await kc.credentialReadiness(invitation.subject);
  if(!credentials.passwordConfigured||!credentials.recoveryReady)throw new Error('NATIVE_PASSWORD_OR_RECOVERY_NOT_CONFIGURED');
  if(scenario.factor==='recovery'&&process.env['S01_NATIVE_BOUNDARY_ONLY']==='1'){stage='native-recovery-concurrency';await qualifyConcurrentRecovery({subject:invitation.subject,root:invitation.root,password,codes:recoveryCodes},kc);}
  stage='native-action-cleanup';
  const actionUrl=new URL(page.url());if(actionUrl.searchParams.has('key'))throw new Error('NATIVE_ACTION_KEY_RETAINED');
  stage='native-oidc-start';
  await page.goto(origin+'/v1/auth/oidc/start');
  if(scenario.factor==='recovery'){
    stage='public-native-session-replacement';
    const previousPage=page;
    const oldAction=await previousPage.locator('#username').evaluate(element=>(element as HTMLInputElement).form!.action);
    // Leave the native document before replacing shared cookies: its session-check
    // JavaScript may reload the tab and destroy an in-flight assertion context.
    await previousPage.goto(origin+'/health');
    const nextPage=await page.context().newPage();await nextPage.goto(origin+'/v1/auth/oidc/start');
    const rejected=await previousPage.evaluate(async input=>(await fetch(input.action,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:input.subject,password:input.password})})).status,{action:oldAction,subject:invitation.subject,password});
    if(rejected!==403)throw new Error('PUBLIC_OLD_NATIVE_SESSION_NOT_CLOSED');
    await previousPage.close();page=nextPage;
    page.on('response',response=>{if(new URL(response.url()).pathname==='/v1/auth/oidc/callback'){callbackUrl=response.url();callbackFailure=String(response.status());}});
  }
  stage='native-oidc-username';
  await page.locator('#username').fill(invitation.subject);
  stage='native-oidc-password';
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"],input[type="submit"]').first().click();
  stage='native-oidc-challenge';
  await page.waitForURL(url=>url.pathname==='/v1/auth/oidc/callback'||url.pathname.includes('/login-actions/'),{timeout:15000});
  if(scenario.factor==='totp'&&await page.locator('#recoveryCodeInput').count()){
    stage='native-factor-choice';
    stage='native-factor-choice-link';
    await page.getByRole('link',{name:/try another way/i}).click();
    await page.waitForLoadState('domcontentloaded');
    stage='native-factor-choice-select';
    await page.getByRole('button',{name:/privacyIDEA/i}).click();
    await page.waitForLoadState('domcontentloaded');
  }
  if(scenario.factor==='recovery'){
    stage='native-recovery-authentication';
    const recovery=page.locator('#recoveryCodeInput');await recovery.waitFor();
    const label=await page.locator('label[for="recoveryCodeInput"]').innerText();const number=Number(label.match(/#(\d+)/)?.[1]);
    const recoveryCode=recoveryCodes[number-1]?.trim();if(!recoveryCode||!/^\w{4}-\w{4}-\w{4}$/.test(recoveryCode))throw new Error('NATIVE_RECOVERY_FIXTURE_UNAVAILABLE');
    await recovery.fill(recoveryCode);
    stage='public-recovery-concurrency';
    const submission=await recovery.evaluate(element=>{
      const form=(element as HTMLInputElement).form;if(!form)throw new Error('FORM_ABSENT');
      const body=new URLSearchParams();for(const [name,value] of new FormData(form)){if(typeof value!=='string')throw new Error('FORM_INVALID');body.append(name,value);}
      return {action:form.action,body:body.toString()};
    });
    // Submit the exact native form from a stable document on the same TLS origin.
    // Both requests still use the real browser cookies and backend/native routes.
    await page.goto(origin+'/health');
    const concurrent=await page.evaluate(async input=>{
      let checkpoint='CONCURRENT_FETCH';try{
      const {action,body}=input;const results=await Promise.all([0,1].map(async()=>{
        let response:Response;try{response=await fetch(action,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});}catch{return {status:0,scope:undefined};}
        return {status:response.status};
      }));
      checkpoint='REPLAY_FETCH';const replay=await fetch(action,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
      return {results,replayStatus:replay.status,error:'NONE'};
      }catch(error){return {results:[],replayStatus:0,error:checkpoint+'_'+(error instanceof TypeError?'TYPE_ERROR':error instanceof ReferenceError?'REFERENCE_ERROR':error instanceof SyntaxError?'SYNTAX_ERROR':'OTHER_ERROR')};}
    },submission);
    if(concurrent.results.filter(result=>result.status===200).length!==1||concurrent.results.filter(result=>result.status===403).length!==1||concurrent.replayStatus!==403){stage='public-recovery-concurrency-'+concurrent.error+'-'+concurrent.results.map(r=>r.status).join('_')+'-replay'+concurrent.replayStatus;throw new Error('PUBLIC_RECOVERY_NOT_SINGLE_USE');}
    await page.goto(origin+'/v1/session');
  }
  if(await page.locator('input[name="otp"],input[name="passcode"],#otp').count()){
    stage='native-pi-challenge';
    const otp=page.locator('input[name="otp"],input[name="passcode"],#otp');
    await otp.waitFor({timeout:5000});
    stage='native-replayed-enrollment-otp';
    if(Math.floor(Date.now()/30000)>enrollmentCounter+1)throw new Error('NATIVE_REPLAY_PERIOD_EXPIRED');
    await otp.fill(firstEnrollmentOtp);await page.locator('button[type="submit"],input[type="submit"]').first().click();await otp.waitFor();
    if(await page.context().cookies(origin).then(cookies=>cookies.some(cookie=>cookie.name==='__Host-dossiercle')))throw new Error('NATIVE_REPLAYED_OTP_GRANTED');
    for(let attempt=0;Math.floor(Date.now()/30000)<enrollmentCounter+2&&attempt<130;attempt++)await new Promise(resolve=>setTimeout(resolve,500));
    if(Math.floor(Date.now()/30000)<enrollmentCounter+2)throw new Error('NATIVE_TOTP_REPLAY_WINDOW_TIMEOUT');
    let loginOtp=await fixtureOtp(seed);
    stage='native-invalid-and-replayed-otp';
    for(const badOtp of [loginOtp==='000000'?'000001':'000000',await fixtureOtp(seed,-120),await fixtureOtp(seed,120)]){
      await otp.fill(badOtp);await page.locator('button[type="submit"],input[type="submit"]').first().click();await otp.waitFor();
      if(await page.context().cookies(origin).then(cookies=>cookies.some(cookie=>cookie.name==='__Host-dossiercle')))throw new Error('NATIVE_BAD_OTP_GRANTED');
      await new Promise(resolve=>setTimeout(resolve,1100));
    }
    loginOtp=await fixtureOtp(seed);
    if(loginOtp===firstEnrollmentOtp)throw new Error('NATIVE_TOTP_REPLAY_WINDOW_TIMEOUT');
    await otp.fill(loginOtp);
    await page.locator('button[type="submit"],input[type="submit"]').first().click();
    stage='native-callback';
    try{await page.waitForURL(origin+'/v1/session',{timeout:15000});}catch{
      stage='native-callback-'+callbackFailure+'-'+nativeFailure;throw new Error('NATIVE_CALLBACK_NOT_REACHED');
    }
  }
  await page.waitForURL(origin+'/v1/session',{timeout:15000});
  const session=await page.evaluate(async()=>await (await fetch('/v1/session')).json() as {scope?:string;agencyId?:string|null;csrfToken?:string});
  if(session.scope!==scenario.scope||session.agencyId!==null)throw new Error('NATIVE_BFF_SESSION_INVALID');
  const sessionCookie=await page.context().cookies(origin);
  if(!sessionCookie.some(cookie=>cookie.name==='__Host-dossiercle'&&cookie.httpOnly&&cookie.secure&&cookie.sameSite==='Lax'))throw new Error('NATIVE_BFF_COOKIE_INVALID');
  stage='native-human-refresh';
  const bff=sessionCookie.find(cookie=>cookie.name==='__Host-dossiercle');
  if(!bff||!session.csrfToken)throw new Error('NATIVE_BFF_SESSION_INVALID');
  await qualifyNativeHumanRefresh('__Host-dossiercle='+bff.value,session.csrfToken,kc);
  const refreshed=await page.evaluate(async()=>await (await fetch('/v1/session')).json() as {scope?:string});
  if(refreshed.scope!==scenario.scope)throw new Error('NATIVE_REFRESH_SESSION_CLOSED');
  stage='native-csrf-replay-and-logout';
  const forbidden=await page.evaluate(async()=>await fetch('/v1/auth/logout',{method:'POST',headers:{'X-CSRF-Token':'A'.repeat(43)}}).then(r=>r.status));
  if(forbidden!==403)throw new Error('NATIVE_LOGOUT_CSRF_NOT_CLOSED');
  if(!callbackUrl)throw new Error('NATIVE_CALLBACK_NOT_SEEN');
  const replay=await page.evaluate(async url=>(await fetch(url)).status,callbackUrl);
  if(replay!==401&&replay!==403)throw new Error('NATIVE_CALLBACK_REPLAY_NOT_CLOSED');
  if(scenario.logout==='faults'){
    stage='native-service-key-journal-waf-failures';const failureObservation=await qualifyNativeFailures(page,invitation.subject);
    // Require a new maintained password+MFA/Code flow after restart, never reopen an old SID.
    stage='native-recovery-after-service-restart';
    const replacement=await reissueSyntheticEnrollment({subject:invitation.subject,root:invitation.root});
    await page.goto(origin+'/enrollment/start#token='+replacement);await page.waitForURL(origin+'/');
    await page.goto(origin+'/v1/auth/oidc/start');await page.locator('#username').fill(invitation.subject);await page.locator('#password').fill(password);
    await page.locator('button[type="submit"],input[type="submit"]').first().click();
    const recovery=page.locator('#recoveryCodeInput');await recovery.waitFor();
    const label=await page.locator('label[for="recoveryCodeInput"]').innerText(),number=Number(label.match(/#(\d+)/)?.[1]);
    if(!Number.isSafeInteger(number)||number<2||!recoveryCodes[number-1])throw new Error('NATIVE_RESTART_RECOVERY_INDEX');
    await recovery.fill(recoveryCodes[number-1]!.trim());await page.locator('button[type="submit"],input[type="submit"]').first().click();await page.waitForURL(origin+'/v1/session');
    const next=await page.evaluate(async()=>await (await fetch('/v1/session')).json() as {scope?:string;agencyId?:string|null;csrfToken?:string});
    if(next.scope!=='onboarding'||next.agencyId!==null||!next.csrfToken)throw new Error('NATIVE_RESTART_RECOVERY_NOT_STRONG');
    if(await page.evaluate(async csrf=>(await fetch('/v1/auth/logout',{method:'POST',headers:{'X-CSRF-Token':csrf}})).status,next.csrfToken)!==204)throw new Error('NATIVE_RESTART_RECOVERY_LOGOUT');
    await writeFile('.local/t04-fault-observation.json',JSON.stringify({syntheticOnly:true,keycloakAfterRestart:failureObservation.resumed,keyFaultObservations:failureObservation.keyFaultObservations,freshNativeMfaConfirmed:true,logoutConfirmed:true})+'\n',{mode:0o600});
  }else if(scenario.logout==='native-password'){
    stage='native-password-change-durable-denial';
    await resetSyntheticNativePassword(invitation.subject,'Synthetic!'+randomBytes(24).toString('base64url'));
    const closed=await page.evaluate(async()=>(await fetch('/v1/session')).status);
    if(closed!==401)throw new Error('NATIVE_PASSWORD_CHANGE_NOT_DENIED');
    const head=await new AuthorityJournal('.local/journal/application').head(invitation.subject);
    if(head?.state!=='DENIED'||head.epoch!==2n)throw new Error('NATIVE_PASSWORD_DENIAL_NOT_DURABLE');
    await resetSyntheticNativePassword(invitation.subject,password);
    const restored=await page.evaluate(async()=>(await fetch('/v1/session')).status);
    if(restored!==401&&restored!==403)throw new Error('NATIVE_PASSWORD_RESTORATION_REOPENED');
  }else if(scenario.logout==='native-change'){
    stage='native-change-durable-denial';
    await setSyntheticNativeEnabled(invitation.subject,false);
    try{
      const closed=await page.evaluate(async()=>(await fetch('/v1/session')).status);
      if(closed!==401)throw new Error('NATIVE_CHANGED_IDENTITY_NOT_DENIED');
      const head=await new AuthorityJournal('.local/journal/application').head(invitation.subject);
      if(head?.state!=='DENIED'||head.epoch!==2n)throw new Error('NATIVE_CHANGED_IDENTITY_DENIAL_NOT_DURABLE');
    }finally{await setSyntheticNativeEnabled(invitation.subject,true);}
    const restored=await page.evaluate(async()=>(await fetch('/v1/session')).status);
    if(restored!==401&&restored!==403)throw new Error('NATIVE_RESTORED_IDENTITY_REOPENED');
    stage='native-synthetic-rotation';await qualifySyntheticRotation(invitation.subject,seed,firstEnrollmentOtp,enrollmentCounter);
  }else if(scenario.logout==='backchannel'){
    stage='native-signed-backchannel';await triggerSyntheticNativeLogout(invitation.subject);
  }else{
    const logout=await page.evaluate(async csrf=>(await fetch('/v1/auth/logout',{method:'POST',headers:{'X-CSRF-Token':csrf}})).status,session.csrfToken);
    if(logout!==204)throw new Error('NATIVE_LOGOUT_NOT_CONFIRMED');
  }
  const revoked=await page.evaluate(async()=>(await fetch('/v1/session')).status);
  if(revoked!==401&&!(['native-change','native-password'].includes(scenario.logout)&&revoked===403))throw new Error('NATIVE_LOGOUT_SESSION_STILL_OPEN');
  if(scenario.logout==='throttle'){
    stage='native-password-five-failures';
    const replacement=await reissueSyntheticEnrollment({subject:invitation.subject,root:invitation.root});
    await page.goto(origin+'/enrollment/start#token='+replacement);await page.waitForURL(origin+'/');
    await page.goto(origin+'/v1/auth/oidc/start');await page.locator('#username').waitFor();
    const submitPassword=async(value:string)=>{
      await page.locator('#username').fill(invitation.subject);await page.locator('#password').fill(value);
      await Promise.all([page.waitForEvent('domcontentloaded'),page.locator('button[type="submit"],input[type="submit"]').first().click()]);
    };
    for(let attempt=0;attempt<5;attempt++){await submitPassword('SyntheticWrongPassword!');await page.locator('#password').waitFor();await new Promise(resolve=>setTimeout(resolve,1100));}
    await new Promise(resolve=>setTimeout(resolve,500));
    const failure=await syntheticNativeFailureStatus(invitation.subject);
    if(!failure.disabled||failure.failures<5){stage='native-password-five-failures-'+failure.failures+'-'+failure.disabled;throw new Error('NATIVE_BRUTE_FORCE_NOT_THROTTLED');}
    await submitPassword(password);await page.locator('#password').waitFor();
    if(await page.evaluate(async()=>(await fetch('/v1/session')).status)!==401)throw new Error('NATIVE_THROTTLED_LOGIN_GRANTED');
    stage='native-password-progressive-delay-recovery';
    await new Promise(resolve=>setTimeout(resolve,65000));
    await submitPassword(password);const recovery=page.locator('#recoveryCodeInput');await recovery.waitFor();
    const label=await page.locator('label[for="recoveryCodeInput"]').innerText(),number=Number(label.match(/#(\d+)/)?.[1]);
    if(!Number.isSafeInteger(number)||number<2||!recoveryCodes[number-1])throw new Error('NATIVE_THROTTLE_RECOVERY_INDEX');
    await recovery.fill(recoveryCodes[number-1]!.trim());await page.locator('button[type="submit"],input[type="submit"]').first().click();await page.waitForURL(origin+'/v1/session');
    const next=await page.evaluate(async()=>await (await fetch('/v1/session')).json() as {scope?:string;csrfToken?:string});
    if(next.scope!=='onboarding'||!next.csrfToken)throw new Error('NATIVE_THROTTLE_RECOVERY_NOT_STRONG');
    if(await page.evaluate(async csrf=>(await fetch('/v1/auth/logout',{method:'POST',headers:{'X-CSRF-Token':csrf}})).status,next.csrfToken)!==204)throw new Error('NATIVE_THROTTLE_RECOVERY_LOGOUT');
  }
  if(scenario.factor==='recovery'&&scenario.logout==='local'){
    stage='public-recovery-replay-new-grant';
    const replacement=await reissueSyntheticEnrollment({subject:invitation.subject,root:invitation.root});
    await page.goto(origin+'/enrollment/start#token='+replacement);await page.waitForURL(origin+'/');
    await page.goto(origin+'/v1/auth/oidc/start');await page.locator('#username').fill(invitation.subject);await page.locator('#password').fill(password);
    await page.locator('button[type="submit"],input[type="submit"]').first().click();
    const recovery=page.locator('#recoveryCodeInput');await recovery.waitFor();
    await recovery.fill(recoveryCodes[0]!.trim());await page.locator('button[type="submit"],input[type="submit"]').first().click();
    await recovery.waitFor();
    if(await page.context().cookies(origin).then(cookies=>cookies.some(cookie=>cookie.name==='__Host-dossiercle')))throw new Error('PUBLIC_CONSUMED_RECOVERY_GRANTED');
    if(await page.evaluate(async()=>(await fetch('/v1/session')).status)!==401)throw new Error('PUBLIC_CONSUMED_RECOVERY_GRANTED');
    const label=await page.locator('label[for="recoveryCodeInput"]').innerText(),number=Number(label.match(/#(\d+)/)?.[1]);
    if(!Number.isSafeInteger(number)||number<2||!recoveryCodes[number-1])throw new Error('PUBLIC_RECOVERY_INDEX_NOT_ADVANCED');
    await recovery.fill(recoveryCodes[number-1]!.trim());await page.locator('button[type="submit"],input[type="submit"]').first().click();
    await page.waitForURL(origin+'/v1/session');
    const nextSession=await page.evaluate(async()=>await (await fetch('/v1/session')).json() as {scope?:string;agencyId?:string|null;csrfToken?:string});
    if(nextSession.scope!=='onboarding'||nextSession.agencyId!==null||!nextSession.csrfToken)throw new Error('PUBLIC_NEW_RECOVERY_NOT_CONFIRMED');
    if(await page.evaluate(async csrf=>(await fetch('/v1/auth/logout',{method:'POST',headers:{'X-CSRF-Token':csrf}})).status,nextSession.csrfToken)!==204)throw new Error('PUBLIC_NEW_RECOVERY_LOGOUT_FAILED');
  }


  await page.goto('about:blank');
 }catch(error){await page.goto('about:blank').catch(()=>{});const detail=error instanceof Error&&/^[A-Z_0-9]{1,160}$/.test(error.message)?error.message:error instanceof Error&&error.message.includes('__name is not defined')?'EVALUATE_HELPER_MISSING':error instanceof Error&&error.name==='TimeoutError'?'BROWSER_TIMEOUT':'UNCLASSIFIED';throw new Error('NATIVE_CANDIDATE_BROWSER_CHECK_FAILED_'+stage+'_'+detail);}
 finally{if(restoreOwner)await restoreOwner();}
 });
}
test('Keycloak browser endpoints pass only through the fixed loopback realm ingress',async({page})=>{
 const issuerOrigin=origin;
 const metadataResponse=await page.goto(issuerOrigin+'/realms/dossiercle/.well-known/openid-configuration');
 if(metadataResponse?.status()!==200)throw new Error('NATIVE_ISSUER_DISCOVERY_FAILED');
 const metadata=await page.evaluate(async()=>await (await fetch(location.href)).json() as {issuer?:string});
 if(metadata.issuer!==issuerOrigin+'/realms/dossiercle')throw new Error('NATIVE_ISSUER_MISMATCH');
 const protectedStatuses=await page.evaluate(async()=>Promise.all([
  '/realms/dossiercle/login-actions/required-action','/realms/dossiercle/login-actions/%72equired-action',
  '/realms/dossiercle/login-actions//required-action','/realms/dossiercle/login-actions/required-action;param=x',
  '/realms/dossiercle/login-actions;param=x/required-action','/realms/dossiercle/login-actions/other;param=x/required-action',
  '/realms/dossiercle/login-actions/../login-actions/required-action',
 ].map(async path=>(await fetch(path,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:''})).status)));
 if(protectedStatuses.some(status=>status!==403))throw new Error('NATIVE_REQUIRED_ACTION_POST_NOT_BLOCKED_AT_INGRESS_'+protectedStatuses.join('_'));
 const closedRoutes=await page.evaluate(async()=>Promise.all([
  '/realms/dossiercle/account/','/realms/dossiercle/account','/realms/dossiercle/broker/foreign/login',
  '/realms/dossiercle/protocol/openid-connect/token','/realms/dossiercle/protocol/openid-connect/auth/device',
  '/realms/dossiercle/protocol/openid-connect/ext/ciba/auth','/realms/dossiercle/protocol/openid-connect/logout',
  '/realms/dossiercle/login-actions/reset-credentials','/realms/dossiercle/login-actions/action-token?key=forged',
 ].flatMap(path=>['GET','POST'].map(async method=>(await fetch(path,{method,...(method==='POST'?{headers:{'Content-Type':'application/x-www-form-urlencoded'},body:''}:{})})).status))));
 if(closedRoutes.some(status=>status!==403&&status!==404))throw new Error('NATIVE_UNCONTROLLED_ROUTE_OPEN_'+closedRoutes.join('_'));
 const admin=await page.goto(issuerOrigin+'/admin/');if(admin?.status()!==404)throw new Error('NATIVE_ADMIN_ROUTE_OPEN');
 const otherRealm=await page.goto(issuerOrigin+'/realms/other/.well-known/openid-configuration');if(otherRealm?.status()!==403)throw new Error('NATIVE_OTHER_REALM_OPEN');
 const business=await page.goto(issuerOrigin+'/');if(business?.status()!==403)throw new Error('NATIVE_BUSINESS_ROUTE_OPEN');
 const localhostRealm=await page.goto(origin.replace('localhost','127.0.0.1')+'/realms/dossiercle/.well-known/openid-configuration');if(localhostRealm?.status()!==503)throw new Error('NATIVE_REALM_WRONG_HOST_OPEN');
});
test('OIDC start binds the public issuer to the fixed localhost callback',async({page})=>{
 const invitation=await nativePendingInvitation();
 let grantStatus=0;let grantCookieAttributes='absent';
 page.on('response',response=>{if(new URL(response.url()).pathname==='/enrollment/grant'){grantStatus=response.status();const header=response.headers()['set-cookie'];grantCookieAttributes=header?header.split(';').slice(1).join(';').trim(): 'absent';}});
 await page.goto(origin+'/enrollment/start#token='+invitation.token);
 await page.waitForURL(origin+'/');
  const safeCookies=await page.context().cookies(origin).then(cookies=>cookies.map(({name,httpOnly,secure,sameSite,domain,path})=>({name,httpOnly,secure,sameSite,domain,path})));
  if(!safeCookies.some(cookie=>cookie.name==='__Host-s01-enrollment'&&cookie.httpOnly&&cookie.secure&&cookie.sameSite==='Lax'))throw new Error(`OIDC_GRANT_COOKIE_INVALID_${grantStatus}_${grantCookieAttributes}_${JSON.stringify(safeCookies)}`);
 await page.goto(origin+'/v1/auth/oidc/start');
 const redirect=new URL(page.url());
 if(redirect.origin!==origin||redirect.searchParams.get('redirect_uri')!==origin+'/v1/auth/oidc/callback'
   ||redirect.searchParams.get('code_challenge_method')!=='S256'||redirect.searchParams.get('acr_values')!=='2')throw new Error('OIDC_ORIGIN_BINDING_INVALID');
 if(await page.context().cookies(origin).then(cookies=>!cookies.some(cookie=>cookie.name==='__Host-s01-oidc'&&cookie.httpOnly&&cookie.secure&&cookie.sameSite==='Lax')))throw new Error('OIDC_STATE_COOKIE_INVALID');
});
test('native callback and realm forgery matrix cannot mint BFF state or mutate J1',async({page})=>{
 const invitation=await nativePendingInvitation();
 await page.goto(origin+'/enrollment/start#token='+invitation.token);await page.waitForURL(origin+'/');
 await page.goto(origin+'/v1/auth/oidc/start');await page.locator('#username').waitFor();
 const authority=new AuthorityJournal('.local/journal/application'),before=await authority.head(invitation.subject);
 const url=new URL(page.url());
 for(const [name,value] of [['nonce','forged'],['state','forged'],['scope','openid profile'],['client_id','account'],['acr_values','0'],['prompt','none'],['login_hint','foreign'],['id_token_hint','forged']]){
   const forged=new URL(url);forged.searchParams.set(name!,value!);
   const status=await page.evaluate(async href=>(await fetch(href)).status,forged.href);
   if(status!==403)throw new Error('NATIVE_AUTHORIZATION_FORGERY_OPEN');
 }
 const posts=await page.evaluate(async()=>{
   const paths=['/realms/dossiercle/login-actions/authenticate','/realms/dossiercle/login-actions/required-action'];
   const cases=[{query:'scope=openid',body:''},{query:'%73cope=openid',body:''},{query:'id_token_hint=forged',body:''},{query:'scope=x&scope=y',body:''},
    {query:'',body:'scope=openid'},{query:'',body:'%73cope=openid'},{query:'',body:'ID_TOKEN_HINT=forged'},{query:'',body:'scope=x&%73cope=y'},
    {query:'scope=x',body:'scope=y'},{query:'',body:'authenticationExecution=foreign'}, {query:'',body:'username=foreign'}];
   const results=await Promise.all(paths.flatMap(path=>cases.map(async c=>(await fetch(path+(c.query?'?'+c.query:''),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:c.body})).status)));
   const multipart=new FormData();multipart.append('scope','openid');results.push((await fetch(paths[0]!,{method:'POST',body:multipart})).status);
   results.push((await fetch(paths[0]!,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"scope":"openid"}'})).status);return results;
 });
 if(posts.slice(0,-2).some(status=>status!==403&&status!==400)||posts.slice(-2).some(status=>status!==415))throw new Error('NATIVE_MUTATION_FORGERY_OPEN_'+posts.join('_'));
 for(const query of ['code=forged&state=forged','code=x&code=y&state=forged','code=x&state=forged&nonce=x','code=x&state=forged&iss=https%3A%2F%2Fexample.invalid']){
   const status=await page.evaluate(async path=>(await fetch(path)).status,'/v1/auth/oidc/callback?'+query);
   if(status!==401&&status!==403)throw new Error('NATIVE_CALLBACK_FORGERY_OPEN');
 }
 if((await authority.head(invitation.subject))?.hash!==before?.hash)throw new Error('UNBOUND_CALLBACK_MUTATED_JOURNAL');
 if(await page.context().cookies(origin).then(cookies=>cookies.some(cookie=>cookie.name==='__Host-dossiercle')))throw new Error('NATIVE_FORGERY_MINTED_BFF');
 await page.goto('about:blank');
});
// Gate V3 is the complete executed suite, never a declaration or unconditional placeholder.
test('coordinator restart closes transient grants and rejects admission replay',async({page})=>{
 const invitation=await nativePendingInvitation();
 await page.goto(origin+'/enrollment/start#token='+invitation.token);await page.waitForURL(origin+'/');
 await page.goto(origin+'/v1/auth/oidc/start');await page.locator('#username').waitFor();
 const journal=new AuthorityJournal('.local/journal/application'),before=await journal.head(invitation.subject);
 await run('docker',['compose','--env-file','.local/compose.env','-f','infra/local/compose.yaml','restart','identity-coordinator']);
 await run('docker',['compose','--profile','identity-runtime','--env-file','.local/compose.env','-f','infra/local/compose.yaml','up','-d','--wait','--wait-timeout','30','identity-coordinator']);
 const status=await page.evaluate(async()=>(await fetch('/v1/auth/oidc/start')).status);
 if(status!==401&&status!==403)throw new Error('RESTARTED_TRANSIENT_GRANT_OPEN');
 const replay=await page.evaluate(async token=>(await fetch('/enrollment/grant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})})).status,invitation.token);
 if(replay!==403)throw new Error('RESTARTED_ADMISSION_REPLAY_OPEN');
 if((await journal.head(invitation.subject))?.hash!==before?.hash)throw new Error('RESTARTED_GRANT_MUTATED_AUTHORITY');
 if(await page.evaluate(async()=>(await fetch('/v1/session')).status)!==401)throw new Error('RESTARTED_GRANT_MINTED_BFF');
 await page.goto('about:blank');
});
