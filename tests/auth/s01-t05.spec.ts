import { test } from '@playwright/test';
import { readFile,writeFile,rename } from 'node:fs/promises';
import { spawn,execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { controlPool } from '../../packages/adapters/dist/postgres/runtime-pool.js';
import { e,nativePage,nativePendingInvitation,enrollNative } from './private-t05-native.js';
const run=promisify(execFile);
async function confirmation(email:string){
 return new Promise<{identityConfirmationRef:string;recoveryChannelRef:string}>((resolve,reject)=>{
  const child=spawn(process.execPath,['scripts/s01-owner-confirmation.ts','--synthetic-fixture'],{stdio:['pipe','pipe','pipe']});let out='',err='';
  child.stdout.on('data',chunk=>{out+=String(chunk);});child.stderr.on('data',chunk=>{err+=String(chunk);});child.on('error',()=>reject(new Error('OWNER_PROCEDURE_UNAVAILABLE')));
  child.on('exit',code=>{if(code!==0||err){reject(new Error('OWNER_PROCEDURE_CLOSED'));return;}try{resolve(JSON.parse(out));}catch{reject(new Error('OWNER_PROCEDURE_CLOSED'));}});
  child.stdin.end(JSON.stringify({email}));
 });
}
test('T05 native owner MFA -> invitation -> native guest MFA -> receipt claim -> durable PROVISIONING',async()=>{
 test.setTimeout(600000);let stage='configuration';
 const ownerBrowser=await nativePage();let guestBrowser:Awaited<ReturnType<typeof nativePage>>|undefined;
 const configPath=e.private+'/coordinator/config.json',previous=await readFile(configPath,'utf8'),owner=randomUUID();
 const writeConfig=async(value:string)=>{const next=configPath+'.t05-test-next';await writeFile(next,value,{flag:'wx',mode:0o400});await rename(next,configPath);
  await run('docker',['compose','--env-file','.local/compose.env','-f','infra/local/compose.yaml','restart','identity-coordinator']);
  await run('docker',['compose','--profile','identity-runtime','--env-file','.local/compose.env','-f','infra/local/compose.yaml','up','-d','--wait','--wait-timeout','30','identity-coordinator']);};
 const pool=controlPool({host:'127.0.0.1',port:e.pgPort,role:'control_api',password:(await readFile(e.private+'/pg/control_api','utf8')).trim(),max:2});
 try{
  const config=JSON.parse(previous) as {syntheticOnly:boolean;ownerSubject:string};if(!config.syntheticOnly)throw new Error('SYNTHETIC_REQUIRED');config.ownerSubject=owner;await writeConfig(JSON.stringify(config));
  stage='owner-bootstrap-native';const ownerInvitation=await nativePendingInvitation(owner),ownerSession=await enrollNative(ownerBrowser.page,ownerInvitation,value=>{stage='owner-'+value;});
  if(ownerSession.scope!=='platform'||!ownerSession.csrfToken)throw new Error('OWNER_SCOPE_ABSENT');
  stage='owner-human-confirmation';const email=randomUUID()+'@example.invalid',refs=await confirmation(email);
  stage='owner-api-create';
  const accepted=await ownerBrowser.page.evaluate(async input=>{
   const response=await fetch('/v1/platform/agencies/invitations',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':input.csrf,'Idempotency-Key':input.key},body:JSON.stringify(input.body)});
   return {status:response.status,body:await response.json() as {invitationId?:string}};
  },{csrf:ownerSession.csrfToken,key:randomUUID(),body:{email,...refs}});
  if(accepted.status!==202||!accepted.body.invitationId)throw new Error('INVITATION_NOT_DURABLE_202');
  const invitation=(await pool.query('SELECT subject_id,root_id,contact,status,identity_status FROM control.agency_invitation WHERE id=$1',[accepted.body.invitationId])).rows[0];
  if(invitation?.identity_status!=='CONFIRMED'||invitation.status!=='PENDING_IDENTITY')throw new Error('NATIVE_PREPARATION_NOT_CONFIRMED');
  stage='owner-api-issue';const issueKey=randomUUID();
  const issued=await ownerBrowser.page.evaluate(async input=>{
   const response=await fetch('/v1/platform/agencies/invitations/'+input.id+'/issue',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':input.csrf,'Idempotency-Key':input.key,'If-Match':'"1"'},body:'{}'});
   return {status:response.status,body:await response.json() as {enrollmentUrl?:string}};
  },{csrf:ownerSession.csrfToken,key:issueKey,id:accepted.body.invitationId});
  if(issued.status!==200||!issued.body.enrollmentUrl)throw new Error('NATIVE_GRANT_NOT_ISSUED');
  const token=new URLSearchParams(new URL(issued.body.enrollmentUrl).hash.slice(1)).get('token');if(!token)throw new Error('GRANT_FRAGMENT_ABSENT');
  stage='owner-get-replay-no-secret';
  const safe=await ownerBrowser.page.evaluate(async input=>{
   const get=await fetch('/v1/platform/agencies/invitations/'+input.id),getBody=await get.json();
   const replay=await fetch('/v1/platform/agencies/invitations/'+input.id+'/issue',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':input.csrf,'Idempotency-Key':input.key,'If-Match':'"0"'},body:'{}'}),replayBody=await replay.json();
   return get.status===200&&replay.status===200&&!('enrollmentUrl'in getBody)&&!('enrollmentUrl'in replayBody)&&![...Object.values(localStorage),...Object.values(sessionStorage)].some(value=>String(value).includes(input.token));
  },{id:accepted.body.invitationId,csrf:ownerSession.csrfToken,key:issueKey,token});
  if(!safe)throw new Error('GRANT_EXPOSED_ON_GET_REPLAY_STORAGE');
  guestBrowser=await nativePage();stage='guest-native';
  const guestSession=await enrollNative(guestBrowser.page,{subject:invitation.subject_id,root:invitation.root_id,contact:invitation.contact,token},value=>{stage='guest-'+value;});
  if(guestSession.scope!=='onboarding'||!guestSession.csrfToken)throw new Error('GUEST_SCOPE_ABSENT');
  stage='guest-claim-empty';const claimed=await guestBrowser.page.evaluate(async csrf=>(await fetch('/v1/onboarding/invitation/claim',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:'{}'})).status,guestSession.csrfToken);
  if(claimed!==200)throw new Error('RECEIPT_CLAIM_FAILED');
  stage='guest-create-durable';const key=randomUUID();
  const result=await guestBrowser.page.evaluate(async input=>{
   const headers={'Content-Type':'application/json','X-CSRF-Token':input.csrf,'Idempotency-Key':input.key},body=JSON.stringify({name:'Agence native T05'});
   const created=await fetch('/v1/agencies',{method:'POST',headers,body}),accepted=await created.json() as {agencyId?:string;operationId?:string;state?:string};
   const get=await fetch('/v1/onboarding/agency'),current=await get.json();const replay=await fetch('/v1/agencies',{method:'POST',headers,body}),replayed=await replay.json();
   const clean=!location.href.includes(input.token)&&![...Object.values(localStorage),...Object.values(sessionStorage)].some(value=>String(value).includes(input.token));
   const cache=(get.headers.get('Cache-Control')??'').split(',').map(value=>value.trim());
   return {created:created.status,get:get.status,replay:replay.status,accepted,equal:JSON.stringify(accepted)===JSON.stringify(current)&&JSON.stringify(accepted)===JSON.stringify(replayed),clean,noStore:cache.length>0&&cache.every(value=>value==='no-store'),noStoreDirectives:cache.length};
  },{csrf:guestSession.csrfToken,key,token});
  await writeFile('.local/t05-native-attempt.json',JSON.stringify({syntheticOnly:true,created:result.created,get:result.get,replay:result.replay,equal:result.equal,clean:result.clean,noStore:result.noStore,noStoreDirectives:result.noStoreDirectives,provisioning:result.accepted.state==='PROVISIONING',operationPresent:Boolean(result.accepted.operationId)})+'\n',{mode:0o600});
  if(result.created!==202||result.get!==200||result.replay!==202||!result.equal||!result.clean||!result.noStore||result.accepted.state!=='PROVISIONING'||!result.accepted.operationId)throw new Error('NATIVE_AGENCY_NOT_DURABLE');
  stage='postgres-provisioning-only';const persisted=(await pool.query(`SELECT a.state,m.role,m.state AS membership_state,o.step,o.status,EXISTS(SELECT 1 FROM control.database_locator l WHERE l.agency_id=a.id) AS has_locator
   FROM control.agency a JOIN identity.membership m ON m.agency_id=a.id JOIN control.provisioning_operation o ON o.agency_id=a.id WHERE a.id=$1`,[result.accepted.agencyId])).rows[0];
  if(persisted?.state!=='PROVISIONING'||persisted.role!=='ADMIN'||persisted.membership_state!=='PENDING'||persisted.step!=='ACCEPTED'||persisted.status!=='PENDING'||persisted.has_locator)throw new Error('NATIVE_CREATION_DEFAULTS_NOT_CLOSED');
  await writeFile('.local/t05-browser-observation.json',JSON.stringify({syntheticOnly:true,ownerNativeMfa:true,guestNativeMfa:true,invitation202:true,issue200:true,claimEmpty200:true,agency202:true,getReplaySame:true,provisioningOnly:true,noRawTokenGetReplayStorage:true})+'\n',{mode:0o600});
 }catch(error){const reason=error instanceof Error&&/^[A-Z_0-9]{1,160}$/.test(error.message)?error.message:error instanceof Error&&error.name==='TimeoutError'?'BROWSER_TIMEOUT':'UNCLASSIFIED';throw new Error('T05_NATIVE_FAILED_'+stage+'_'+reason);}
 finally{await ownerBrowser.page.goto('about:blank').catch(()=>{});if(guestBrowser)await guestBrowser.context.close();await ownerBrowser.context.close();await pool.end();await writeConfig(previous);}
});
