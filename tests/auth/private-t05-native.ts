import type { Page } from '@playwright/test';
import { readFile,mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID,randomBytes,createHash } from 'node:crypto';
import { controlPool } from '../../packages/adapters/dist/postgres/runtime-pool.js';
import { AuthorityJournal } from '../../packages/adapters/dist/journal/authority-journal.js';
import { KeycloakAdapter } from '../../packages/adapters/dist/identity/keycloak-adapter.js';
import { EnrollmentAdapter } from '../../packages/adapters/dist/identity/enrollment-adapter.js';
import { firefox } from '@playwright/test';
import { fixtureOtp } from './private-otp-fixture.js';
export const e=JSON.parse(await readFile('.local/environment.json','utf8')) as {root:string;private:string;project:string;pgPort:number;tlsPort:number;syntheticOnly:boolean};
if(!e.syntheticOnly||e.root!==process.cwd())throw new Error('SYNTHETIC_REQUIRED');
export const origin='https://localhost:'+e.tlsPort;
const run=promisify(execFile);
const secret=async(path:string)=>(await readFile(e.private+'/'+path,'utf8')).trim();
async function fillSensitive(page:Page,selector:string,value:string,stage:(value:string)=>void){try{await page.locator(selector).fill(value);}catch{stage('native-sensitive-fill-failed');throw new Error('NATIVE_SENSITIVE_FILL_FAILED');}}
async function address(service:string){const r=await run('docker',['inspect','--format','{{json .NetworkSettings.Networks}}',e.project+'-'+service+'-1']);return (JSON.parse(r.stdout) as Record<string,{IPAddress:string}>)[e.project+'_private']!.IPAddress;}
export async function nativePage(options:{headless?:boolean;zoom200?:boolean}={}){
 const profile='.local/browser-profiles/'+randomUUID();await mkdir(profile,{recursive:true,mode:0o700});
 await run('certutil',['-N','--empty-password','-d','sql:'+profile]);
 await run('certutil',['-A','-n','s01-synthetic-only','-t','C,,','-i',e.private+'/ca/ca.crt','-d','sql:'+profile]);
 const context=await firefox.launchPersistentContext(profile,{headless:options.headless??true,ignoreHTTPSErrors:false,...(options.zoom200?{viewport:null}:{})});
 return {context,page:context.pages()[0]??await context.newPage()};
}
type NativeAuthPayload={result?:{value?:{token?:string}}};
type NativeInitPayload={result?:{status?:boolean};detail?:{otpkey?:{value_b32?:string};serial?:string}};
type NativeVerifyPayload={result?:{status?:boolean;value?:boolean}};
export async function nativePendingInvitation(reservedSubject?:string){
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
    VALUES($1,$2,$3,$4,$5,'CONFIRMED','ISSUED',$6,now()+interval '10 minutes')`,[randomUUID(),root,subject,subject+'@example.invalid',reservedSubject??randomUUID(),createHash('sha256').update(token).digest('hex')]);
  return {subject,root,token,contact:subject+'@example.invalid'};
 }finally{client.release();await pool.end();await api.end();}
}
async function nativeKeycloak(){return new KeycloakAdapter({transport:{advertisedOrigin:'https://localhost:'+e.tlsPort,host:await address('keycloak'),port:8443,serverName:'keycloak',caFile:e.private+'/ca/ca.crt'},callbackOrigin:origin,realm:'dossiercle',clientId:'s01-bff',clientSecret:await secret('kc/client-s01-bff'),administrativeClientId:'s01-identity',administrativeSecret:await secret('kc/client-s01-identity'),importClientId:'s01-importer',importSecret:await secret('kc/client-s01-importer')});}
async function nativeActionLink(project:string,recipient:string){
 const script=`const h=require('node:http');const get=p=>new Promise((resolve,reject)=>h.get('http://mailpit:8025'+p,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{resolve(JSON.parse(b))}catch{reject(Error())}})}).on('error',reject));(async()=>{const port=process.argv[1],to=process.argv[2],list=await get('/api/v1/messages?start=0&limit=100'),item=list.messages?.find(m=>m.To?.some(x=>x.Address===to));if(!item)throw Error();const detail=await get('/api/v1/message/'+encodeURIComponent(item.ID)),body=String(detail.HTML||'')+' '+String(detail.Text||''),links=[...body.matchAll(/https?:[^\\s<>\"']+/g)].map(x=>x[0].replace(/&amp;/g,'&'));for(const value of links){try{const u=new URL(value);if(u.hostname==='localhost'&&u.port===port&&u.pathname==='/realms/dossiercle/login-actions/action-token'){process.stdout.write(u.href);return}}catch{}}throw Error()})().catch(()=>process.exit(2));`;
 const {stdout}=await run('docker',['exec',project+'-identity-coordinator-1','/s01-node','-e',script,String(e.tlsPort),recipient]);
 const link=stdout.trim();if(!link||link.length>8192)throw new Error('NATIVE_ACTION_LINK_UNAVAILABLE');
 return link;
}

/** Same native enrollment routes as T04, with real PI enrollment and Keycloak recovery MFA. */
export async function enrollNative(page:Page,invitation:{subject:string;root:string;token:string;contact:string},stage:(value:string)=>void){
 try{return await enrollNativeUnsafe(page,invitation,stage);}catch{stage('native-enrollment-helper-failed');throw new Error('NATIVE_ENROLLMENT_HELPER_FAILED');}
}
async function enrollNativeUnsafe(page:Page,invitation:{subject:string;root:string;token:string;contact:string},stage:(value:string)=>void){
 page.setDefaultTimeout(15000);
  stage('grant');
  await page.goto(origin+'/enrollment/start#token='+invitation.token);
  await page.waitForURL(origin+'/');
  await page.waitForFunction(()=>document.querySelector('#REMOTE_USER')!==null);
  const hasIdentity=await page.locator('#REMOTE_USER').evaluate((element)=>Boolean((element as HTMLInputElement).value));
  if(!hasIdentity)throw new Error('NATIVE_IDENTITY_ABSENT');
  stage('native-auth');
  const nativeAuth=page.waitForResponse(r=>r.url()===origin+'/auth'&&r.request().method()==='POST',{timeout:10000}).then(async r=>({status:r.status(),payload:await r.json() as NativeAuthPayload})).catch(()=>({status:0,payload:{} as NativeAuthPayload}));
  await page.locator('button[ng-click="authenticate_remote_user()"]').click();
  const authenticated=await nativeAuth;
  const nativeJwt=authenticated.payload.result?.value?.token;
  if(authenticated.status!==200||!nativeJwt)throw new Error('NATIVE_AUTH_FAILED');
  stage('native-enroll-route');
  await page.locator('a[ui-sref="token.enroll"]').click();
  stage('native-enroll-policy');
  await page.waitForFunction(()=>{const select=document.querySelector<HTMLSelectElement>('#tokentype');return Boolean(select&&select.options[select.selectedIndex]?.textContent?.trim().toLowerCase().startsWith('totp:'));});
  const typeIsTotp=await page.locator('#tokentype').evaluate((element)=>((element as HTMLSelectElement).options[(element as HTMLSelectElement).selectedIndex]?.textContent??'').trim().toLowerCase().startsWith('totp:'));
  if(!typeIsTotp)throw new Error('NATIVE_ENROLLMENT_TYPE_NOT_READY');
  stage('native-enroll-submit');
  const initialized=page.waitForResponse(r=>r.url()===origin+'/token/init'&&r.request().method()==='POST',{timeout:10000}).then(async r=>({status:r.status(),payload:await r.json() as NativeInitPayload})).catch(()=>({status:0,payload:{} as NativeInitPayload}));
  await page.locator('button[ng-click="enrollToken()"]').click();
  stage('native-enroll-result');
  const nativeInit=await initialized;

  const seed=nativeInit.payload.detail?.otpkey?.value_b32;
  if(nativeInit.status!==200||nativeInit.payload.result?.status!==true||!seed)throw new Error('NATIVE_ENROLLMENT_FAILED');
  stage('first-otp');
  const firstEnrollmentOtp=await fixtureOtp(seed);
  await fillSensitive(page,'#verifyResponse',firstEnrollmentOtp,stage);
  const verified=page.waitForResponse(r=>r.url()===origin+'/token/init'&&r.request().method()==='POST',{timeout:10000}).then(async r=>({status:r.status(),payload:await r.json() as NativeVerifyPayload})).catch(()=>({status:0,payload:{} as NativeVerifyPayload}));
  await page.locator('form[ng-submit="sendVerifyResponse()"] button[type="submit"]').click();
  const nativeVerify=await verified;
  if(nativeVerify.status!==200||nativeVerify.payload.result?.status!==true||nativeVerify.payload.result.value!==true)throw new Error('NATIVE_FIRST_OTP_NOT_VERIFIED');
  stage('native-enrollment-proof');
  const pi=new EnrollmentAdapter({transport:{advertisedOrigin:'https://privacyidea:8443',host:await address('privacyidea'),port:8443,serverName:'privacyidea',caFile:e.private+'/ca/ca.crt'},verifierPassword:await secret('pi/verifier-password')});
  const proof=await pi.proof(invitation.subject,invitation.subject);
  if(proof.enrollmentVerified!==true)throw new Error('NATIVE_ENROLLMENT_PROOF_ABSENT');
  stage('native-browser-storage');
  // Browser storage is origin-scoped, so check the PI origin before visiting Keycloak.
  const storageIsEmpty=await page.evaluate(jwt=>![...Object.values(localStorage),...Object.values(sessionStorage)].some(value=>String(value).includes(jwt)),nativeJwt);
  if(!storageIsEmpty)throw new Error('NATIVE_BROWSER_STORAGE_NOT_EMPTY');
  const cleanUrl=page.url().startsWith(origin+'/')&&!page.url().includes(invitation.token);if(!cleanUrl)throw new Error('FRAGMENT_NOT_CLEANED');
  const denied=await page.evaluate(async()=>{const response=await fetch('/token/init?keysize=1',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"type":"totp","genkey":1}'});return response.status===403;});
  if(!denied)throw new Error('QUERY_OVERRIDE_NOT_DENIED');
  stage('native-user-state');
  const kc=await nativeKeycloak();const nativeUser=await kc.user(invitation.subject);
  if(!nativeUser.enabled||nativeUser.contact!==invitation.contact)throw new Error('NATIVE_USER_MISMATCH');
  stage('native-required-action-email');
  const actionsStatus=await page.evaluate(async jwt=>(await fetch('/v1/auth/enrollment/actions',{method:'POST',headers:{'Content-Type':'application/json','PI-Authorization':jwt},body:'{}'})).status,nativeJwt);if(actionsStatus!==204)throw new Error('NATIVE_ACTIONS_NOT_ADMITTED_HTTP'+actionsStatus);
  stage('native-action-link');
  const actionLink=await nativeActionLink(e.project,invitation.contact);
  stage('native-action-token-proof');
  try{kc.checkActionTokenClaims(new URL(actionLink).searchParams.get('key')!,invitation.subject);}catch(error){
    const safe=error as {code?:string;claim?:string};stage('native-action-token-proof-'+(safe.code??'BOUNDARY')+'-'+(safe.claim??''));throw new Error('NATIVE_ACTION_TOKEN_INVALID');
  }
  stage('native-action-page');
  const actionPage=await page.goto(actionLink);if(!actionPage||actionPage.status()!==200){stage('native-action-page-http'+String(actionPage?.status()));throw new Error('NATIVE_ACTION_PAGE_UNAVAILABLE');}
  await page.getByRole('link',{name:/click here to proceed/i}).click();
  stage('native-password-form');
  await page.locator('#password-new').waitFor();
  const password=randomBytes(32).toString('base64url');
  await fillSensitive(page,'#password-new',password,stage);await fillSensitive(page,'#password-confirm',password,stage);
  const passwordSubmitted=page.waitForResponse(r=>new URL(r.url()).pathname==='/realms/dossiercle/login-actions/required-action'&&r.request().method()==='POST');
  await page.locator('button[type="submit"],input[type="submit"]').first().click();
  const passwordResponse=await passwordSubmitted;const passwordStatus=passwordResponse.status();if(passwordStatus>=400){stage('native-password-submit-http'+passwordStatus);throw new Error('NATIVE_PASSWORD_MUTATION_FAILED');}
  await page.waitForLoadState('domcontentloaded');
  if(await page.locator('#firstName').count()){
    stage('native-profile-first-name');await page.locator('#firstName').fill('S01');
    stage('native-profile-last-name');await page.locator('#lastName').fill('Synthetic');
    stage('native-profile-submit');
    await page.locator('button[type="submit"],input[type="submit"]').first().click();
  }
  stage('native-recovery-form');
  await page.locator('input[type="checkbox"]').first().waitFor();
  const recoveryCodes=await page.locator('#kc-recovery-codes-list li').allTextContents();
  await page.locator('input[type="checkbox"]').first().check();
  await page.locator('button[type="submit"],input[type="submit"]').last().click();
  const credentials=await kc.credentialReadiness(invitation.subject);
  if(!credentials.passwordConfigured||!credentials.recoveryReady)throw new Error('NATIVE_PASSWORD_OR_RECOVERY_NOT_CONFIGURED');


  stage('native-oidc-start');await page.goto(origin+'/v1/auth/oidc/start');
 await page.locator('#username').fill(invitation.subject);await fillSensitive(page,'#password',password,stage);
  await page.locator('button[type="submit"],input[type="submit"]').first().click();
  stage('native-recovery-authentication');const recovery=page.locator('#recoveryCodeInput');await recovery.waitFor();
  const label=await page.locator('label[for="recoveryCodeInput"]').innerText(),number=Number(label.match(/#(\d+)/)?.[1]);
  const code=recoveryCodes[number-1]?.trim();if(!code||!/^\w{4}-\w{4}-\w{4}$/.test(code))throw new Error('NATIVE_RECOVERY_FIXTURE_UNAVAILABLE');
 await fillSensitive(page,'#recoveryCodeInput',code,stage);await page.locator('button[type="submit"],input[type="submit"]').first().click();
 await page.waitForURL(origin+'/app/onboarding');
  const session=await page.evaluate(async()=>await (await fetch('/v1/session')).json() as {scope?:string;agencyId?:string|null;csrfToken?:string});
  if(!session.csrfToken||!['onboarding','platform'].includes(session.scope??''))throw new Error('NATIVE_BFF_NOT_STRONG');
  const reauthRecoveryCode=recoveryCodes.map(value=>value.trim()).find(value=>value!==code&&/^\w{4}-\w{4}-\w{4}$/.test(value));
  if(!reauthRecoveryCode)throw new Error('NATIVE_RECOVERY_FIXTURE_UNAVAILABLE');
  return {...session,password,reauthRecoveryCode,recoveryCodes:recoveryCodes.map(value=>value.trim())};
}

/** Exercise real bootstrap reauthentication routes and native MFA; credentials stay in process memory. */
export async function reauthenticateNative(page:Page,input:{subject:string;contact:string;password:string;recoveryCode?:string;recoveryCodes?:readonly string[];beforeDeniedCallback?:()=>Promise<void>},stage:(value:string)=>void=()=>{}):Promise<{scope?:string;agencyId?:string|null;csrfToken?:string;denied?:boolean}>{
 try{return await reauthenticateNativeUnsafe(page,input,stage);}catch{stage('native-reauth-helper-failed');throw new Error('NATIVE_REAUTH_HELPER_FAILED');}
}
async function reauthenticateNativeUnsafe(page:Page,input:{subject:string;contact:string;password:string;recoveryCode?:string;recoveryCodes?:readonly string[];beforeDeniedCallback?:()=>Promise<void>},stage:(value:string)=>void):Promise<{scope?:string;agencyId?:string|null;csrfToken?:string;denied?:boolean}>{
 stage('context');
 await page.goto(origin+'/health');
 await page.context().clearCookies({name:/^(?:AUTH_SESSION_ID(?:_LEGACY)?|KEYCLOAK_[A-Z_]+|KC_[A-Z_]+)$/});
 const contextResponse=await page.goto(origin+'/v1/auth/bootstrap/reauth/context');
 if(contextResponse?.status()!==200)throw new Error('BOOTSTRAP_REAUTH_CONTEXT_FAILED');
 const context=await contextResponse.json() as {csrfNonce?:string};
 if(typeof context.csrfNonce!=='string')throw new Error('BOOTSTRAP_REAUTH_CONTEXT_INVALID');
 stage('start');const started=await page.evaluate(async value=>{
  const response=await fetch('/v1/auth/bootstrap/reauth/start',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-S01-Bootstrap-CSRF':value.nonce},body:JSON.stringify({email:value.contact})});
  return {status:response.status,body:await response.json() as {continueUrl?:string}};
 },{nonce:context.csrfNonce,contact:input.contact});
 if(started.status!==202||started.body.continueUrl!=='/v1/auth/bootstrap/reauth/continue')throw new Error('BOOTSTRAP_REAUTH_START_HTTP'+started.status);
 stage('native-form');const form=await page.goto(origin+started.body.continueUrl);
 if(form?.status()!==200)throw new Error('BOOTSTRAP_NATIVE_FORM_HTTP'+form?.status());
 stage('native-password');
 await page.locator('#username').fill(input.subject);await fillSensitive(page,'#password',input.password,stage);
 await page.locator('button[type="submit"],input[type="submit"]').first().click();
 stage('native-mfa');const recovery=page.locator('#recoveryCodeInput');await recovery.waitFor();
 const label=await page.locator('label[for="recoveryCodeInput"]').innerText(),number=Number(label.match(/#(\d+)/)?.[1]);
 const code=input.recoveryCodes?.[number-1]??input.recoveryCode;
 if(!code||!/^\w{4}-\w{4}-\w{4}$/.test(code))throw new Error('NATIVE_RECOVERY_FIXTURE_UNAVAILABLE');
 await fillSensitive(page,'#recoveryCodeInput',code,stage);
 if(input.beforeDeniedCallback){
  // Submit the real, emitted native MFA form in the browser, holding its redirect.
  // The callback is then navigated explicitly after the synthetic authority fault.
  const action=await recovery.evaluate(element=>(element as HTMLInputElement).form!.action);
  const nativeResponse=page.waitForResponse(response=>response.url()===action&&response.request().method()==='POST');
  await recovery.evaluate(async element=>{
   const form=(element as HTMLInputElement).form!;
   const body=new URLSearchParams();for(const [name,value] of new FormData(form)){if(typeof value!=='string')throw new Error('NATIVE_FORM_INVALID');body.append(name,value);}
   await fetch(form.action,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,credentials:'same-origin',redirect:'manual'});
  });
  const response=await nativeResponse,location=await response.headerValue('location');
  if(![302,303].includes(response.status())||!location)throw new Error('NATIVE_MFA_REDIRECT_ABSENT');
  const callback=new URL(location,origin);
  if(callback.origin!==origin||callback.pathname!=='/v1/auth/bootstrap/reauth/callback')throw new Error('NATIVE_MFA_CALLBACK_INVALID');
  await input.beforeDeniedCallback();
  const refused=await page.goto(callback.href);
  if(![401,403].includes(refused?.status()??0))throw new Error('BOOTSTRAP_CALLBACK_NOT_CLOSED_HTTP'+refused?.status());
  return {denied:true};
 }
 await page.locator('button[type="submit"],input[type="submit"]').first().click();
 stage('callback');await page.waitForURL(origin+'/app/onboarding');
 return await page.evaluate(async()=>await (await fetch('/v1/session',{cache:'no-store'})).json() as {scope?:string;agencyId?:string|null;csrfToken?:string});
}
