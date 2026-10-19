import { test, expect, type Page } from '@playwright/test';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Pool } from '../../packages/adapters/dist/postgres/runtime-pool.js';
import { AuthorityJournal } from '../../packages/adapters/dist/journal/authority-journal.js';
import { ControlRepository } from '../../packages/adapters/dist/postgres/control.repository.js';
import { nativeTransport } from '../../packages/adapters/dist/identity/native-transport.js';
import { request as httpsRequest } from 'node:https';
import { e, origin, nativePage, nativePendingInvitation, enrollNative, reauthenticateNative } from './private-t05-native.js';

const run=promisify(execFile);
const nativeCookies=/^(?:AUTH_SESSION_ID(?:_LEGACY)?|KEYCLOAK_[A-Z_]+|KC_[A-Z_]+)$/;
const safeFailure=(error:unknown)=>error instanceof Error&&/^[A-Z_0-9]{1,160}$/.test(error.message)?error.message
  :error&&typeof error==='object'&&'code'in error&&/^[A-Z_0-9]{1,30}$/.test(String(error.code))?String(error.code)
    :error instanceof Error?error.name.toUpperCase():'NATIVE_BROWSER_BOUNDARY';
async function pool(role='control_migrator'){
  return new Pool({host:'127.0.0.1',port:e.pgPort,database:'control',user:role,password:(await readFile(e.private+'/pg/'+role,'utf8')).trim(),max:1});
}
async function config(value:string){
  const path=e.private+'/coordinator/config.json',next=path+'.bootstrap-test-next';
  await writeFile(next,value,{flag:'wx',mode:0o400});await rename(next,path);
  await run('docker',['compose','--env-file','.local/compose.env','-f','infra/local/compose.yaml','restart','identity-coordinator']);
  await run('docker',['compose','--profile','identity-runtime','--env-file','.local/compose.env','-f','infra/local/compose.yaml','up','-d','--wait','--wait-timeout','30','identity-coordinator']);
}
async function expire(page:Page,mode:'idle'|'absolute'){
  const cookie=(await page.context().cookies(origin)).find(item=>item.name==='__Host-dossiercle');
  if(!cookie)throw new Error('NATIVE_BFF_COOKIE_ABSENT');
  const db=await pool(),hash=createHash('sha256').update(cookie.value).digest('hex');
  try{
    if(mode==='idle')await db.query("UPDATE identity.session SET issued_at=now()-interval '31 minutes',last_human_activity_at=now()-interval '31 minutes',absolute_expires_at=now()+interval '14 days' WHERE cookie_hash=$1",[hash]);
    else await db.query("UPDATE identity.session SET issued_at=now()-interval '15 days',absolute_expires_at=now()-interval '1 second' WHERE cookie_hash=$1",[hash]);
  }finally{await db.end();}
  expect(await page.evaluate(async()=>(await fetch('/v1/session')).status)).toBe(401);
}
async function start(page:Page,email:string){
  const response=await page.goto(origin+'/v1/auth/bootstrap/reauth/context');
  if(response?.status()!==200)throw new Error('BOOTSTRAP_CONTEXT_FAILED');
  const context=await response.json() as {csrfNonce:string};
  return await page.evaluate(async input=>{
    const response=await fetch('/v1/auth/bootstrap/reauth/start',{method:'POST',headers:{'Content-Type':'application/json','X-S01-Bootstrap-CSRF':input.nonce},body:JSON.stringify({email:input.email})});
    return {status:response.status,retryAfter:response.headers.get('Retry-After'),body:await response.json() as {continueUrl?:string}};
  },{email,nonce:context.csrfNonce});
}
async function respectReauthBudget(starts:number[]){
  if(starts.length>=3){
    const remaining=60_200-(Date.now()-starts[starts.length-3]!);
    if(remaining>0)await new Promise(resolve=>setTimeout(resolve,remaining));
  }
  starts.push(Date.now());
}

test('bootstrap reauth owner recovers idle and absolute expiry with fresh native MFA and JSON landing',async()=>{
  test.setTimeout(300_000);let stage='setup';
  const previous=await readFile(e.private+'/coordinator/config.json','utf8'),subject=randomUUID(),browser=await nativePage();
  try{
    const next=JSON.parse(previous) as {ownerSubject:string};next.ownerSubject=subject;await config(JSON.stringify(next));
    stage='enroll';const invitation=await nativePendingInvitation(subject),initial=await enrollNative(browser.page,invitation,value=>{stage=value;});
    expect(initial.scope).toBe('platform');
    let nativeCookieExposed=false;
    browser.page.on('response',response=>{if(new URL(response.url()).pathname.startsWith('/realms/'))void response.headersArray().then(headers=>{
      if(headers.some(header=>header.name.toLowerCase()==='set-cookie'))nativeCookieExposed=true;
    });});
    for(const mode of ['idle','absolute'] as const){
      stage='expire-'+mode;await expire(browser.page,mode);stage='reauth-'+mode;
      const session=await reauthenticateNative(browser.page,{subject,contact:invitation.contact,password:initial.password,recoveryCodes:initial.recoveryCodes},value=>{stage=mode+'-'+value;});
      expect(session.scope).toBe('platform');expect(Boolean(session.csrfToken&&session.csrfToken!==initial.csrfToken)).toBe(true);
      expect(browser.page.url()).toBe(origin+'/v1/session');
      expect((await browser.context.cookies(origin)).some(cookie=>nativeCookies.test(cookie.name))).toBe(false);
    }
    expect(nativeCookieExposed).toBe(false);
    const db=await pool();
    try{expect((await db.query('SELECT count(*)::int AS total,count(*) FILTER(WHERE revoked_at IS NOT NULL)::int AS replaced FROM identity.session WHERE subject_id=$1',[subject])).rows[0]).toEqual({total:3,replaced:2});}
    finally{await db.end();}
  }catch(error){throw new Error('BOOTSTRAP_OWNER_FAILED_'+stage+'_'+safeFailure(error));}
  finally{await browser.page.goto('about:blank').catch(()=>{});await browser.context.close();await config(previous);}
});

test('bootstrap reauth guest renews current receipts before claim, after claim, READY and ACTIVE without automatic mutations',async()=>{
  test.setTimeout(600_000);let stage='setup';
  const browser=await nativePage(),db=await pool();
  try{
    const invitation=await nativePendingInvitation(),initial=await enrollNative(browser.page,invitation,value=>{stage=value;});
    expect(initial.scope).toBe('onboarding');
    const credentials={subject:invitation.subject,contact:invitation.contact,password:initial.password,recoveryCodes:initial.recoveryCodes};
    const starts:number[]=[];
    let mutations=0;
    browser.page.on('request',request=>{if(request.method()==='POST'&&/^\/v1\/(?:agencies(?:\/|$)|onboarding\/invitation\/claim)/.test(new URL(request.url()).pathname))mutations++;});
    stage='before-claim';await expire(browser.page,'idle');await respectReauthBudget(starts);let session=await reauthenticateNative(browser.page,credentials,value=>{stage='before-claim-'+value;});
    expect(session.scope).toBe('onboarding');expect(mutations).toBe(0);
    stage='claim';
    expect(await browser.page.evaluate(async csrf=>(await fetch('/v1/onboarding/invitation/claim',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf!},body:'{}'})).status,session.csrfToken)).toBe(200);
    stage='after-claim';await expire(browser.page,'absolute');await respectReauthBudget(starts);session=await reauthenticateNative(browser.page,credentials,value=>{stage='after-claim-'+value;});
    expect(session.scope).toBe('onboarding');expect(mutations).toBe(1);
    await db.query("UPDATE control.agency_invitation SET expires_at=now()-interval '1 second' WHERE root_id=$1",[invitation.root]);
    stage='declare-scope';
    await run(process.execPath,['--input-type=module','-e',
      "import{fixturePool,declareT07Scope}from './scripts/s01-fixture-manifests.mjs';const pool=await fixturePool();try{await declareT07Scope(pool,JSON.parse(process.argv[1]))}finally{await pool.end()}",
      JSON.stringify({rootId:invitation.root,subjectId:invitation.subject})]);
    stage='create';
    const created=await browser.page.evaluate(async input=>{
      const response=await fetch('/v1/agencies',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':input.csrf!,'Idempotency-Key':input.key},body:JSON.stringify({name:'Agence réauth native PR1'})});
      return {status:response.status,body:await response.json() as {agencyId:string;operationId:string;state:string}};
    },{csrf:session.csrfToken,key:randomUUID()});
    expect(created.status).toBe(202);expect(created.body.state).toBe('PROVISIONING');
    await run(process.execPath,['scripts/s01-fixture-manifests.mjs','capture']);
    stage='ready';const deadline=Date.now()+240_000;let ready=false;
    while(Date.now()<deadline){
      const row=(await db.query('SELECT state FROM control.agency WHERE id=$1',[created.body.agencyId])).rows[0];
      if(row?.state==='FAILED')throw new Error('NATIVE_PROVISIONING_FAILED');
      if(row?.state==='READY'){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,250));
    }
    expect(ready).toBe(true);await expire(browser.page,'idle');await respectReauthBudget(starts);session=await reauthenticateNative(browser.page,credentials,value=>{stage='ready-'+value;});
    expect(session.scope).toBe('onboarding');expect(mutations).toBe(2);
    const activation=await browser.page.evaluate(async id=>await (await fetch('/v1/agencies/'+id+'/activation')).json() as {state:string;canActivate:boolean;version:string;automationEnabled:boolean},created.body.agencyId);
    expect(activation.state).toBe('READY');expect(activation.canActivate).toBe(true);expect(activation.automationEnabled).toBe(false);
    stage='explicit-activation';
    const active=await browser.page.evaluate(async input=>{
      const response=await fetch('/v1/agencies/'+input.id+'/activation',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':input.csrf!,'Idempotency-Key':input.key,'If-Match':'"'+input.version+'"'},body:'{}'});
      return {status:response.status,body:await response.json() as {state:string;automationEnabled:boolean}};
    },{id:created.body.agencyId,csrf:session.csrfToken,key:randomUUID(),version:activation.version});
    expect(active.status).toBe(200);expect(active.body.state).toBe('ACTIVE');expect(active.body.automationEnabled).toBe(false);
    stage='active-reauth';await expire(browser.page,'absolute');await respectReauthBudget(starts);session=await reauthenticateNative(browser.page,credentials,value=>{stage='active-'+value;});
    expect(session.scope).toBe('agency');expect(session.agencyId).toBe(created.body.agencyId);expect(mutations).toBe(3);
    stage='receipt-bindings';
    const receipts=(await db.query(`SELECT count(*)::int AS total,count(DISTINCT result->>'cookieHash')::int AS distinct_cookies,
      bool_and(result->>'subject'=$1::text AND result->>'root'=$2::text AND result->>'epoch'='1') AS current_binding
      FROM control.idempotency_record WHERE actor_id=$1::uuid AND operation_type='identity.onboarding-receipt.v1'`,[invitation.subject,invitation.root])).rows[0];
    expect(receipts).toEqual({total:5,distinct_cookies:5,current_binding:true});
    stage='membership-revocation';await expire(browser.page,'idle');await respectReauthBudget(starts);
    const before=(await db.query('SELECT count(*)::int AS n FROM identity.session WHERE subject_id=$1',[invitation.subject])).rows[0].n;
    const deniedAudits=(await db.query("SELECT count(*)::int AS n FROM control.audit_event WHERE event_type='identity.bootstrap-reauth.failed.v1'")).rows[0].n;
    const beforeDeniedCallback=async()=>{
      const changed=await db.query("UPDATE identity.membership SET state='DENIED' WHERE subject_id=$1 AND agency_id=$2 AND state='ACTIVE'",[invitation.subject,created.body.agencyId]);
      if(changed.rowCount!==1)throw new Error('MEMBERSHIP_FIXTURE_NOT_ACTIVE');
    };
    try{
      const refused=await reauthenticateNative(browser.page,{...credentials,beforeDeniedCallback},value=>{stage='membership-'+value;});
      expect(refused.denied).toBe(true);
      expect((await db.query("SELECT count(*)::int AS n FROM control.audit_event WHERE event_type='identity.bootstrap-reauth.failed.v1'")).rows[0].n).toBe(deniedAudits+1);
      expect((await db.query('SELECT count(*)::int AS n FROM identity.session WHERE subject_id=$1',[invitation.subject])).rows[0].n).toBe(before);
      expect((await db.query("SELECT count(*)::int AS n FROM control.idempotency_record WHERE actor_id=$1 AND operation_type='identity.onboarding-receipt.v1'",[invitation.subject])).rows[0].n).toBe(5);
    }finally{
      // Restore only this generated fixture's reversible membership fault; J1/history are retained.
      await db.query("UPDATE identity.membership SET state='ACTIVE' WHERE subject_id=$1 AND agency_id=$2 AND state='DENIED'",[invitation.subject,created.body.agencyId]);
    }
    stage='revocation';await respectReauthBudget(starts);const started=await start(browser.page,invitation.contact);expect(started.status).toBe(202);
    const coordinator=await pool('control_coordinator');
    try{await new ControlRepository(coordinator,new AuthorityJournal('.local/journal/application')).deny(invitation.subject,randomUUID(),async()=>{});}
    finally{await coordinator.end();}
    const denied=await browser.page.goto(origin+started.body.continueUrl!);expect([401,403]).toContain(denied?.status());
    expect([401,403]).toContain(await browser.page.evaluate(async()=>(await fetch('/v1/session')).status));
  }catch(error){throw new Error('BOOTSTRAP_GUEST_FAILED_'+stage+'_'+safeFailure(error));}
  finally{await browser.page.goto('about:blank').catch(()=>{});await browser.context.close();await db.end();}
});

test('bootstrap reauth rejects expired admission, keeps repeated decoys stable and enforces preauth CSRF',async()=>{
  test.setTimeout(300_000);let stage='setup';
  await config(await readFile(e.private+'/coordinator/config.json','utf8'));
  const browser=await nativePage(),db=await pool();
  try{
    const invitation=await nativePendingInvitation();await enrollNative(browser.page,invitation,value=>{stage=value;});
    stage='expired';await expire(browser.page,'idle');
    await db.query("UPDATE control.agency_invitation SET expires_at=now()-interval '1 second' WHERE root_id=$1",[invitation.root]);
    const expired=await start(browser.page,invitation.contact);expect(expired.status).toBe(202);
    await browser.page.goto(origin+expired.body.continueUrl!);
    expect(await browser.page.locator('#username').inputValue()===invitation.subject).toBe(false);
    const unknown=randomUUID()+'@example.invalid';let previousSelector:string|undefined;
    for(let index=0;index<2;index++){
      stage='unknown-'+index;const result=await start(browser.page,unknown);
      expect(result.status).toBe(202);expect(result.body).toEqual({continueUrl:'/v1/auth/bootstrap/reauth/continue'});
      await browser.page.goto(origin+result.body.continueUrl!);
      const selected=await browser.page.locator('#username').inputValue();
      expect(/^[0-9a-f-]{36}$/.test(selected)).toBe(true);
      if(previousSelector)expect(selected===previousSelector).toBe(true);previousSelector=selected;
    }
    stage='different-subject';
    await browser.page.locator('#username').fill(invitation.subject);await browser.page.locator('#password').fill('synthetic-wrong-password');
    const rejected=browser.page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname.includes('/login-actions/'));
    await browser.page.locator('button[type="submit"],input[type="submit"]').first().click();
    expect([401,403]).toContain((await rejected).status());
    stage='csrf';
    const first=await browser.page.goto(origin+'/v1/auth/bootstrap/reauth/context'),old=await first!.json() as {csrfNonce:string};
    const second=await browser.page.goto(origin+'/v1/auth/bootstrap/reauth/context'),current=await second!.json() as {csrfNonce:string};
    expect(old.csrfNonce!==current.csrfNonce).toBe(true);
    const statuses=await browser.page.evaluate(async input=>{
      const post=(nonce:string,body:string)=>fetch('/v1/auth/bootstrap/reauth/start',{method:'POST',headers:{'Content-Type':'application/json','X-S01-Bootstrap-CSRF':nonce},body}).then(response=>response.status);
      return [await post(input.old,JSON.stringify({email:input.email})),await post(input.current,'{"email":"a@example.invalid","email":"b@example.invalid"}'),
        await post(input.current,'{"\\u0065mail":"a@example.invalid"}')];
    },{old:old.csrfNonce,current:current.csrfNonce,email:unknown});
    expect([401,403]).toContain(statuses[0]);expect(statuses.slice(1)).toEqual([400,400]);
    const direct=nativeTransport({advertisedOrigin:origin,host:'127.0.0.1',port:e.tlsPort,serverName:'localhost',caFile:e.private+'/ca/ca.crt'});
    const cookie=(await browser.context.cookies(origin)).map(item=>item.name+'='+item.value).join('; ');
    const foreign=await direct(origin+'/v1/auth/bootstrap/reauth/start',{method:'POST',headers:{Origin:'https://foreign.example.invalid','Content-Type':'application/json','X-S01-Bootstrap-CSRF':current.csrfNonce,Cookie:cookie},body:JSON.stringify({email:unknown})});
    expect([401,403]).toContain(foreign.status);
    const ca=await readFile(e.private+'/ca/ca.crt'),body=JSON.stringify({email:unknown});
    const duplicate=await new Promise<number>((resolve,reject)=>{
      const request=httpsRequest({host:'127.0.0.1',port:e.tlsPort,servername:'localhost',ca,rejectUnauthorized:true,agent:false,
        path:'/v1/auth/bootstrap/reauth/start',method:'POST',headers:['Host',new URL(origin).host,'Content-Type','application/json','Content-Type','application/json',
          'Origin',origin,'X-S01-Bootstrap-CSRF',current.csrfNonce,'Cookie',cookie,'Content-Length',String(Buffer.byteLength(body))]},response=>{
        response.resume();response.on('end',()=>resolve(response.statusCode??0));
      });
      request.on('error',()=>reject(new Error('PREAUTH_TLS_BOUNDARY_UNAVAILABLE')));request.setTimeout(10000,()=>request.destroy());request.end(body);
    });
    expect(duplicate).toBe(400);
    stage='callback-refusal';
    const started=await start(browser.page,randomUUID()+'@example.invalid');expect(started.status).toBe(202);
    expect([401,403]).toContain((await browser.page.goto(origin+'/v1/auth/bootstrap/reauth/callback?code=synthetic&state=synthetic'))?.status());
    expect([401,403]).toContain(await browser.page.evaluate(async()=>(await fetch('/v1/session')).status));
    const audited=(await db.query("SELECT count(*)::int AS n FROM control.audit_event WHERE event_type='identity.bootstrap-reauth.failed.v1' AND actor_type='service' AND actor_id='00000000-0000-4000-8000-000000000030'")).rows[0];
    expect(audited.n>0).toBe(true);
    expect((await start(browser.page,randomUUID()+'@example.invalid')).status).toBe(202);
    const limited=await start(browser.page,randomUUID()+'@example.invalid');
    expect(limited.status).toBe(429);expect(limited.retryAfter).toBe('60');
  }catch(error){throw new Error('BOOTSTRAP_REFUSAL_FAILED_'+stage+'_'+safeFailure(error));}
  finally{await browser.page.goto('about:blank').catch(()=>{});await browser.context.close();await db.end();}
});
