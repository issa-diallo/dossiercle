import {randomUUID} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {pool,journal,origin} from './private-t05-fixture.js';
import {httpFixture} from './private-t05-http-fixture.js';

describe('real Nest T05 HTTP, strict boundary and durable agency routes',()=>{
  it('routes owner issue and onboarding claim/create/GET through Nest, returns 202 and never refreshes GET',async()=>{
    const f=await httpFixture();try{
      const pending=await f.pending();f.healthy();
      const issued=await f.send('POST',`/v1/platform/agencies/invitations/${pending.invitationId}/issue`,'{}',f.headers(f.request()));
      expect(issued.status).toBe(200);const guest=await f.enroll(issued.body as {enrollmentUrl?:string});
      const initial=await f.send('GET','/v1/onboarding/agency',undefined,{cookie:guest.cookie});expect(initial.status).toBe(204);
      const claim=await f.send('POST','/v1/onboarding/invitation/claim','{}',f.headers(guest.request()));expect(claim.status).toBe(200);
      const command=guest.request(),created=await f.send('POST','/v1/agencies',JSON.stringify({name:'HTTP durable agency'}),f.headers(command));expect(created.status).toBe(202);
      const result=created.body as {agencyId:string;state:string;operationId:string};expect(result.state).toBe('PROVISIONING');
      const before=await journal.head(guest.subject),sessions=(await pool.query('SELECT * FROM identity.session WHERE subject_id=$1',[guest.subject])).rows,calls=f.calls.refresh;
      const get=await f.send('GET','/v1/onboarding/agency',undefined,{cookie:guest.cookie});expect(get.status).toBe(200);expect(get.body).toEqual(result);expect(get.headers['cache-control']).toBe('no-store');
      const activation=await f.send('GET',`/v1/agencies/${result.agencyId}/activation`,undefined,{cookie:guest.cookie});expect(activation.status).toBe(200);
      expect(activation.body).toMatchObject({state:'PROVISIONING',step:'ACCEPTED',canActivate:false,canRetry:false,automationEnabled:false});
      expect(await journal.head(guest.subject)).toEqual(before);expect(f.calls.refresh).toBe(calls);expect((await pool.query('SELECT * FROM identity.session WHERE subject_id=$1',[guest.subject])).rows).toEqual(sessions);
      const replay=await f.send('POST','/v1/agencies',JSON.stringify({name:'HTTP durable agency'}),f.headers(command));expect(replay.status).toBe(202);expect(replay.body).toEqual(result);
    }finally{await f.app.close();}
  });
  it('enforces anonymous/onboarding/owner authorization and CSRF with safe minimal errors from Nest',async()=>{
    const f=await httpFixture();try{
      const pending=await f.pending();f.healthy();const guest=await f.enroll(await f.service.issue(f.request(),pending.invitationId));
      const path=`/v1/platform/agencies/invitations/${pending.invitationId}`;
      const anonymous=await f.send('GET',path);expect(anonymous.status).toBe(401);
      const forbidden=await f.send('GET',path,undefined,{cookie:guest.cookie});expect(forbidden.status).toBe(403);
      const forged=await f.send('POST',path+'/issue','{}',{...f.headers(f.request()),'x-owner-subject':f.owner,origin:'https://evil.invalid'});expect(forged.status).toBe(403);
      const own=await f.send('GET',path,undefined,{cookie:f.cookie});expect(own.status).toBe(200);
      expect(Object.keys(own.body as object).sort()).toEqual(['invitationId','status','version']);
      for(const response of [anonymous,forbidden,forged])expect(Object.keys(response.body as object).sort()).toEqual(['code','correlationId','retryable']);
      expect((await f.send('POST',`/v1/agencies/${randomUUID()}/activate`,'{}',f.headers(guest.request()))).status).toBe(404);
    }finally{await f.app.close();}
  });
  it('rejects duplicate JSON/headers, wrong shapes, over32Kio, query aliases and missing mutation headers before work',async()=>{
    const f=await httpFixture();try{
      const pending=await f.pending(),path=`/v1/platform/agencies/invitations/${pending.invitationId}/issue`,before=await f.snapshot(pending.subjectId);
      const invalidBodies=['{"x":1}','[]','null','{"x":1,"x":2}','{"x":1,"\\u0078":2}','{','{"large":"'+'x'.repeat(32768)+'"}'];
      for(const body of invalidBodies)expect((await f.send('POST',path,body,f.headers(f.request()))).status).toBe(400);
      const duplicate=Object.entries(f.headers(f.request())).flat().concat(['If-Match','"1"']);expect((await f.send('POST',path,'{}',duplicate)).status).toBe(400);
      const missing={cookie:f.cookie,'content-type':'application/json',origin};expect((await f.send('POST',path,'{}',missing)).status).toBe(400);
      expect((await f.send('POST',path+'?token=forbidden','{}',f.headers(f.request()))).status).toBe(404);
      expect(await f.snapshot(pending.subjectId)).toEqual(before);
    }finally{await f.app.close();}
  });
  it('bounds the session bucket at ten and returns Retry-After without refreshing on GET or rate refusal',async()=>{
    const f=await httpFixture();try{
      const pending=await f.pending(),path=`/v1/platform/agencies/invitations/${pending.invitationId}`,before=await f.snapshot(pending.subjectId);
      for(let count=0;count<10;count++)expect((await f.send('GET',path,undefined,{cookie:f.cookie})).status).toBe(200);
      const refused=await f.send('GET',path,undefined,{cookie:f.cookie});expect(refused.status).toBe(429);expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0);
      expect(await f.snapshot(pending.subjectId)).toEqual(before);
    }finally{await f.app.close();}
  });
  it('enforces the IP bucket at sixty anonymous attempts and keeps error payloads bounded',async()=>{
    const f=await httpFixture();try{
      const path='/v1/platform/agencies/invitations/'+randomUUID();
      for(let count=0;count<60;count++)expect((await f.send('GET',path)).status).toBe(401);
      const refused=await f.send('GET',path);expect(refused.status).toBe(429);expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0);
      expect(Object.keys(refused.body as object).sort()).toEqual(['code','correlationId','retryable']);
    }finally{await f.app.close();}
  });
  it.each(['utf8','content-type','origin','cookie'])('rejects raw Node %s ambiguity before refresh',async kind=>{
    const f=await httpFixture();try{
      const pending=await f.pending(),path=`/v1/platform/agencies/invitations/${pending.invitationId}/issue`,before=await f.snapshot(pending.subjectId);
      const headers=Object.entries(f.headers(f.request())).flat();let body:string|Buffer='{}';
      if(kind==='utf8')body=Buffer.from([0xc0,0xaf]);
      if(kind==='content-type')headers.push('Content-Type','application/json');
      if(kind==='origin')headers.push('Origin',origin);
      if(kind==='cookie')headers.push('Cookie',f.cookie);
      expect((await f.send('POST',path,body,headers)).status).toBe(400);expect(await f.snapshot(pending.subjectId)).toEqual(before);
    }finally{await f.app.close();}
  });
  it('checks the current J1 head before HTTP replay rather than trusting a stored completion',async()=>{
    const f=await httpFixture();try{
      const pending=await f.pending();f.healthy();const key=randomUUID();await f.service.issue(f.request(1n,key),pending.invitationId);
      const c=await pool.connect();try{await c.query('BEGIN');await c.query('SELECT subject_id FROM identity.account_authority WHERE subject_id=$1 FOR UPDATE',[f.owner]);
        await journal.append(c,{subjectId:f.owner,commandId:randomUUID(),epoch:2n,state:'DENIED'});await c.query('ROLLBACK');
      }finally{c.release();}
      const calls={...f.calls},response=await f.send('POST',`/v1/platform/agencies/invitations/${pending.invitationId}/issue`,'{}',f.headers(f.request(0n,key)));
      expect(response.status).toBe(503);expect(f.calls).toEqual(calls);
      expect(Object.keys(response.body as object).sort()).toEqual(['code','correlationId','retryable']);
    }finally{await f.app.close();}
  });

});
