import {randomUUID} from 'node:crypto';
import {execFileSync,fork,type ChildProcess} from 'node:child_process';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {beforeAll,describe,expect,it,vi} from 'vitest';
import {NestFactory} from '@nestjs/core';
import {Pool,type PoolClient} from '@dossiercle/adapters/postgres/runtime-pool';
import {ActivationRepository} from '@dossiercle/adapters/postgres/activation.repository';
import {ControlRepository} from '@dossiercle/adapters/postgres/control.repository';
import type {AuthorityJournal} from '@dossiercle/adapters/journal/authority-journal';
import {FileSecretStore} from '@dossiercle/adapters/secrets/secret-store';
import {t05Hash} from '@dossiercle/adapters/postgres/t05.repository';
import {AgenciesService} from '../src/agencies/agencies.service.js';
import {AgenciesModule} from '../src/agencies/agencies.module.js';
import {ActivationAuditService} from '../src/provisioning/activation-audit.service.js';
import {NativeIdentityChanged,NativeSessionEnded} from '../src/auth/auth.service.js';
import {T05HttpBoundary,sendT05Error} from '../src/http/t05-boundary.js';
import {createT07Fixture,awaitT07Ready,t07OnboardingSession,t07LocalAuditCount,startT07Provisioning} from './private-t07-fixture.js';
import {t06Pool,t06Environment,createT06Fixture} from './private-t06-fixture.js';

type Fixture=Awaited<ReturnType<typeof createT07Fixture>>;
const repo=new ActivationRepository();
async function auditService(){
 const env=JSON.parse(await readFile('.local/environment.json','utf8')) as {private:string;pgPort:number};
 const pool=await t06Pool('provisioner');
 return {pool,service:new ActivationAuditService({pool,secrets:new FileSecretStore(env.private+'/t06-migration'),host:'127.0.0.1',port:env.pgPort})};
}
async function reserve(fixture:Fixture){
 const pool=await t06Pool('control_coordinator'),c=await pool.connect();
 try{await c.query('BEGIN');await c.query('SET LOCAL ROLE control_t07');
  const snapshot=await repo.snapshot(c,fixture.agencyId,fixture.subjectId);if(!snapshot)throw new Error('T07_FIXTURE_MISSING');
  const reservation=await repo.reserve(c,snapshot);await c.query('COMMIT');return reservation;
 }finally{await c.query('ROLLBACK');c.release();await pool.end();}
}
async function centralView(fixture:Fixture){
 const pool=await t06Pool('control_migrator');
 try{return (await pool.query(`SELECT a.state,a.activated_at,m.state AS membership,o.step,o.status,
  (SELECT count(*)::int FROM control.audit_event WHERE agency_id=a.id AND event_type='agency.activated.v1') AS audits,
  (SELECT count(*)::int FROM control.outbox WHERE agency_id=a.id AND type='agency.activated.v1') AS outbox,
  (SELECT count(*)::int FROM control.idempotency_record WHERE actor_id=$2 AND operation_type='t07.agency-activation.v1') AS idem
  FROM control.agency a JOIN identity.membership m ON m.agency_id=a.id JOIN control.provisioning_operation o ON o.agency_id=a.id
  WHERE a.id=$1 AND m.subject_id=$2`,[fixture.agencyId,fixture.subjectId])).rows[0];}finally{await pool.end();}
}
async function api(service:AgenciesService){
 const app=await NestFactory.create(AgenciesModule.register({service,boundary:new T05HttpBoundary()}),{logger:false,bodyParser:false});
 app.useGlobalFilters({catch(error:unknown,host:{switchToHttp():{getResponse():import('express').Response}}){sendT05Error(error,host.switchToHttp().getResponse());}});
 await app.listen(0,'127.0.0.1');const address=app.getHttpServer().address() as {port:number};
 return {app,base:`http://127.0.0.1:${address.port}/v1/agencies`};
}
async function activationRequest(base:string,fixture:Fixture,session:Awaited<ReturnType<typeof t07OnboardingSession>>,key=randomUUID()){
 const url=`${base}/${fixture.agencyId}/activation`,response=await fetch(url,{headers:{Cookie:session.cookie}});
 expect(response.status).toBe(200);const view=await response.json() as {version:string};
 return {url,options:{method:'POST',headers:{'Content-Type':'application/json',Cookie:session.cookie,Origin:session.origin,
  'X-CSRF-Token':session.csrf,'Idempotency-Key':key,'If-Match':`"${view.version}"`},body:'{}'}};
}
async function assertForbiddenRoutes(fixture:Fixture,session:Awaited<ReturnType<typeof t07OnboardingSession>>,options:Awaited<ReturnType<typeof activationRequest>>['options']){
 // Each permission case has its own HTTP server and normal admission budget.
 const {app,base}=await api(new AgenciesService({auth:session.auth})),url=`${base}/${fixture.agencyId}/activation`;
 try{
  expect((await fetch(url,{headers:{Cookie:session.cookie}})).status).toBe(403);
  expect((await fetch(url,options)).status).toBe(403);
  expect((await fetch(`${base}/${fixture.agencyId}/provisioning/retry`,options)).status).toBe(403);
 }finally{await app.close();}
}
async function stage(child:ChildProcess,expected:string){
 await new Promise<void>((resolve,reject)=>{
  const cleanup=()=>{clearTimeout(timer);child.off('message',message);child.off('exit',exited);child.off('error',failed);};
  const failed=()=>{cleanup();reject(new Error('T07_WORKER_FAILED_BEFORE_STAGE'));};
  const exited=()=>failed();
  const message=(value:unknown)=>{
   cleanup();try{expect(value).toEqual({stage:expected});resolve();}catch(error){reject(error);}
  };
  const timer=setTimeout(()=>{cleanup();child.kill('SIGKILL');reject(new Error('T07_WORKER_STAGE_TIMEOUT'));},20000);
  child.once('message',message);child.once('exit',exited);child.once('error',failed);
  if(child.exitCode!==null||child.signalCode!==null)failed();
 });
}
async function kill(child:ChildProcess){if(child.exitCode!==null||child.signalCode!==null)return;const exited=once(child,'exit');child.kill('SIGKILL');await exited;}

describe('T07 atomicity, process loss and current authority',()=>{
 let atomic:Fixture,processFixture:Fixture,authority:Fixture;
 beforeAll(async()=>{
  startT07Provisioning();
  atomic=await createT07Fixture();processFixture=await createT07Fixture();authority=await createT07Fixture();
  for(const fixture of [atomic,processFixture,authority])await awaitT07Ready(fixture);
 },360000);

 it('rolls back failures before and after every central write, with no partial visibility',async()=>{
  const reservation=await reserve(atomic),audit=await auditService();
  await audit.service.prepare(reservation.reservationId,reservation.prepared.eventId);
  const expected={state:'READY',activated_at:null,membership:'PENDING',step:'READY',status:'SUCCEEDED',audits:0,outbox:0,idem:0};
  const writes=['update identity.membership','update control.agency','update control.provisioning_operation',
   'insert into control.audit_event','insert into control.outbox','insert into control.idempotency_record'];
  const pool=await t06Pool('control_coordinator');
  try{for(const target of writes)for(const when of ['before','after']){
   const c=await pool.connect();let injected=false;
   try{
    await c.query('BEGIN');await c.query('SET LOCAL ROLE control_t07');
    const snapshot=await repo.snapshot(c,atomic.agencyId,atomic.subjectId);if(!snapshot)throw new Error('T07_FIXTURE_MISSING');
    const guarded=new Proxy(c,{get(client,property){
     if(property==='query')return async(...args:unknown[])=>{
      const matches=typeof args[0]==='string'&&args[0].trim().toLowerCase().startsWith(target);
      if(matches&&when==='before'){injected=true;throw new Error('T07_INJECTED_WRITE_FAILURE');}
      const result=await Reflect.apply(client.query,client,args);
      if(matches&&when==='after'){injected=true;throw new Error('T07_INJECTED_WRITE_FAILURE');}
      return result;
     };
     const value=Reflect.get(client,property);return typeof value==='function'?value.bind(client):value;
    }}) as PoolClient;
    await expect(repo.finalize(guarded,{snapshot,reservation,prepared:reservation.prepared,actorId:atomic.subjectId,
     idempotencyKey:randomUUID(),bodyHash:t05Hash('{}'),correlation:reservation.prepared.correlation})).rejects.toThrow('T07_INJECTED_WRITE_FAILURE');
    expect(injected).toBe(true);expect(await centralView(atomic)).toMatchObject(expected);
   }finally{await c.query('ROLLBACK');c.release();}
   expect(await centralView(atomic)).toMatchObject(expected);
  }
  for(const table of ['identity.membership','control.agency','control.provisioning_operation']){
   const c=await pool.connect();
   try{
    await c.query('BEGIN');await c.query('SET LOCAL ROLE control_t07');
    const snapshot=await repo.snapshot(c,atomic.agencyId,atomic.subjectId);if(!snapshot)throw new Error('T07_FIXTURE_MISSING');
    const column=table==='identity.membership'?'agency_id':'id',id=table==='control.provisioning_operation'?atomic.operationId:atomic.agencyId;
    await c.query(`UPDATE ${table} SET version=version+1 WHERE ${column}=$1`,[id]);
    await expect(repo.finalize(c,{snapshot,reservation,prepared:reservation.prepared,actorId:atomic.subjectId,
     idempotencyKey:randomUUID(),bodyHash:t05Hash('{}'),correlation:reservation.prepared.correlation})).rejects.toThrow('ACTIVATION_FINALIZE_RACE');
    expect(await centralView(atomic)).toMatchObject(expected);
   }finally{await c.query('ROLLBACK');c.release();}
   expect(await centralView(atomic)).toMatchObject(expected);
  }}finally{await pool.end();await audit.pool.end();}
 });

 it('refuses effective runtime ACL drift after READY before any central grant',async()=>{
  const reservation=await reserve(atomic),audit=await auditService(),central=await t06Pool('control_migrator');
  const env=await t06Environment();
  const locator=(await central.query('SELECT * FROM control.database_locator WHERE agency_id=$1',[atomic.agencyId])).rows[0];
  const password=await new FileSecretStore(env.private+'/t06-migration').read({agencyId:atomic.agencyId,operationId:atomic.operationId,
   secretRef:locator.migration_secret_ref,version:1,kind:'migration'});
  const local=new Pool({host:'127.0.0.1',port:env.pgPort,database:locator.database_name,user:locator.migration_role,password:password.toString(),max:1});
  password.fill(0);
  const session=await t07OnboardingSession(atomic.subjectId,atomic.rootId);
  const {app,base}=await api(new AgenciesService({auth:session.auth,activationAudit:{
   prepare:input=>audit.service.prepare(input.reservationId,input.eventId),read:input=>audit.service.read(input.reservationId,input.eventId)}}));
  try{
   await audit.service.prepare(reservation.reservationId,reservation.prepared.eventId);
   for(const [privilege,target] of [['UPDATE','agency_configuration'],['INSERT','audit_event'],['CREATE','SCHEMA public']] as const){
    const object=target.startsWith('SCHEMA ')?target:`TABLE ${target}`;
    // Only server-derived, validated role identifiers enter this host-owned fixture SQL.
    expect(locator.runtime_role).toMatch(/^agr_[a-f0-9]{32}$/);
    await local.query(`GRANT ${privilege} ON ${object} TO "${locator.runtime_role}"`);
    try{
     await expect(audit.service.prepare(reservation.reservationId,reservation.prepared.eventId)).rejects.toThrow('AGENCY_RUNTIME_ACL_DIVERGED');
     await expect(audit.service.read(reservation.reservationId,reservation.prepared.eventId)).rejects.toThrow('AGENCY_RUNTIME_ACL_DIVERGED');
     const request=await activationRequest(base,atomic,session);
     expect((await fetch(request.url,request.options)).status).toBe(503);
     expect(await centralView(atomic)).toMatchObject({state:'READY',membership:'PENDING',audits:0,outbox:0,idem:0});
    }finally{await local.query(`REVOKE ${privilege} ON ${object} FROM "${locator.runtime_role}"`);}
   }
   expect(locator.database_name).toMatch(/^ag_[a-f0-9]{32}$/);
   await local.query(`COMMENT ON DATABASE "${locator.database_name}" IS 't07:synthetic:diverged'`);
   try{
    await expect(audit.service.prepare(reservation.reservationId,reservation.prepared.eventId)).rejects.toThrow('ACTIVATION_LOCAL_CONNECTION_REFUSED');
    await expect(audit.service.read(reservation.reservationId,reservation.prepared.eventId)).rejects.toThrow('ACTIVATION_LOCAL_CONNECTION_REFUSED');
   }finally{await local.query(`COMMENT ON DATABASE "${locator.database_name}" IS 's01:t06:${atomic.agencyId}:${atomic.operationId}:database:v1'`);}
   const host=new Pool({host:'127.0.0.1',port:env.pgPort,database:'postgres',user:'synthetic_bootstrap',
    password:(await readFile(env.private+'/pg/bootstrap','utf8')).trim(),max:1});
   try{
    await host.query(`ALTER DATABASE "${locator.database_name}" OWNER TO provisioner_ddl`);
    try{
     // Owner changes can revoke the former owner’s CONNECT. Keep that access
     // so this case exercises the explicit ownership check after connection.
     await host.query(`GRANT CONNECT ON DATABASE "${locator.database_name}" TO "${locator.migration_role}"`);
     await expect(audit.service.prepare(reservation.reservationId,reservation.prepared.eventId)).rejects.toThrow('ACTIVATION_LOCAL_CONNECTION_REFUSED');
     await expect(audit.service.read(reservation.reservationId,reservation.prepared.eventId)).rejects.toThrow('ACTIVATION_LOCAL_CONNECTION_REFUSED');
     expect(await centralView(atomic)).toMatchObject({state:'READY',membership:'PENDING',audits:0,outbox:0,idem:0});
    }finally{await host.query(`ALTER DATABASE "${locator.database_name}" OWNER TO "${locator.migration_role}"`);}
   }finally{await host.end();}
   await expect(audit.service.read(reservation.reservationId,reservation.prepared.eventId)).resolves.toEqual(reservation.prepared);
  }finally{await app.close();await session.pool.end();await local.end();await central.end();await audit.pool.end();}
 });

 it('refuses cross-agency prepared event, reservation, and migration secret substitutions',async()=>{
  const a=await reserve(atomic),b=await reserve(processFixture),audit=await auditService();
  const central=await t06Pool('control_migrator'),env=await t06Environment();
  try{
   await audit.service.prepare(b.reservationId,b.prepared.eventId);
   await expect(audit.service.prepare(a.reservationId,b.prepared.eventId)).rejects.toThrow();
   await expect(audit.service.read(a.reservationId,b.prepared.eventId)).rejects.toThrow();
   await expect(audit.service.project(a.prepared.eventId)).rejects.toThrow('ACTIVATION_EVENT_SOURCE_REFUSED');
   const locator=(await central.query('SELECT migration_secret_ref FROM control.database_locator WHERE agency_id=$1',[processFixture.agencyId])).rows[0];
   await expect(new FileSecretStore(env.private+'/t06-migration').read({agencyId:atomic.agencyId,operationId:atomic.operationId,
    secretRef:locator.migration_secret_ref,version:1,kind:'migration'})).rejects.toThrow();
   expect(await t07LocalAuditCount(atomic.agencyId,b.prepared.eventId)).toBe(0);
   expect(await t07LocalAuditCount(processFixture.agencyId,b.prepared.eventId)).toBe(1);
   expect(await centralView(atomic)).toMatchObject({state:'READY',membership:'PENDING',audits:0,outbox:0});
  }finally{await audit.pool.end();await central.end();}
 });

 it('serializes duplicate and different concurrent keys without a second grant or audit',async()=>{
  const session=await t07OnboardingSession(atomic.subjectId,atomic.rootId,async()=>{},4),audit=await auditService();
  let prepared=0,release:()=>void=()=>{};
  const barrier=new Promise<void>(resolve=>{release=resolve;});
  const service=new AgenciesService({auth:session.auth,activationAudit:{prepare:async x=>{
   await audit.service.prepare(x.reservationId,x.eventId);if(++prepared===3)release();await barrier;
  },read:x=>audit.service.read(x.reservationId,x.eventId)}});
  const {app,base}=await api(service);
  try{
   const request=await activationRequest(base,atomic,session);
   const another={...request.options,headers:{...request.options.headers,'Idempotency-Key':randomUUID()}};
   const responses=await Promise.all([fetch(request.url,request.options),fetch(request.url,request.options),fetch(request.url,another)]);
   expect(responses.map(r=>r.status)).toEqual([200,200,200]);
   expect(prepared).toBe(3);
   expect(await centralView(atomic)).toMatchObject({state:'ACTIVE',membership:'ACTIVE',step:'ACTIVE',audits:1,outbox:1,idem:1});
   const central=await t06Pool('control_migrator');
   try{
    await central.query("UPDATE identity.session SET scope='agency',agency_id=$2 WHERE subject_id=$1",[atomic.subjectId,atomic.agencyId]);
    expect((await fetch(request.url,{headers:{Cookie:session.cookie}})).status).toBe(200);
    for(const role of ['STANDARD','HABILITED']){
     await central.query('UPDATE identity.membership SET role=$2 WHERE agency_id=$1',[atomic.agencyId,role]);
     await assertForbiddenRoutes(atomic,session,request.options);
    }
   }
   finally{await central.query("UPDATE identity.membership SET role='ADMIN' WHERE agency_id=$1",[atomic.agencyId]);await central.end();}
   expect((await fetch(request.url,{headers:{Cookie:session.cookie}})).status).toBe(200);
   expect((await fetch(request.url,request.options)).status).toBe(200);
  }finally{await app.close();await session.pool.end();await audit.pool.end();}
 });

 it('survives process death before and after commit and repays projection debt after service restart',async()=>{
  const reservation=await reserve(processFixture),audit=await auditService();
  await audit.service.prepare(reservation.reservationId,reservation.prepared.eventId);
  const env=await t06Environment(),host=new Pool({host:'127.0.0.1',port:env.pgPort,database:'postgres',user:'synthetic_bootstrap',
   password:(await readFile(env.private+'/pg/bootstrap','utf8')).trim(),max:1});
  const database=`ag_${processFixture.agencyId.replaceAll('-','')}`;
  const key=randomUUID(),worker=()=>fork('apps/api/test/private-t07-atomic-worker.mjs',[processFixture.agencyId,processFixture.subjectId,key],{stdio:['ignore','ignore','ignore','ipc']});
  let child=worker();
  try{
   await stage(child,'before-commit');expect(await centralView(processFixture)).toMatchObject({state:'READY',membership:'PENDING',audits:0,outbox:0,idem:0});
   await kill(child);
   expect(await centralView(processFixture)).toMatchObject({state:'READY',membership:'PENDING',audits:0,outbox:0,idem:0});
   execFileSync('docker',['compose','--profile','t06','--env-file','.local/compose.env','-f','infra/local/compose.yaml','stop','t06-provisioner'],{stdio:'pipe',timeout:45000});
   const owned=(await host.query("SELECT datdba::regrole::text AS owner,shobj_description(oid,'pg_database') AS tag FROM pg_database WHERE datname=$1",[database])).rows[0];
   expect(owned).toEqual({owner:`agm_${processFixture.agencyId.replaceAll('-','')}`,tag:`s01:t06:${processFixture.agencyId}:${processFixture.operationId}:database:v1`});
   expect(await t07LocalAuditCount(processFixture.agencyId,reservation.activatedEventId)).toBe(0);
   await host.query(`ALTER DATABASE "${database}" ALLOW_CONNECTIONS false`);
   child=worker();await stage(child,'before-commit');child.send('commit');await stage(child,'after-commit');await kill(child);
   expect(await centralView(processFixture)).toMatchObject({state:'ACTIVE',membership:'ACTIVE',audits:1,outbox:1,idem:1});
   await expect(audit.service.project(reservation.activatedEventId)).rejects.toThrow();
   const session=await t07OnboardingSession(processFixture.subjectId,processFixture.rootId);
   const {app,base}=await api(new AgenciesService({auth:session.auth}));
   try{const request=await activationRequest(base,processFixture,session,key);expect((await fetch(request.url,request.options)).status).toBe(200);}
   finally{await app.close();await session.pool.end();}
  }finally{
   if(child.exitCode===null&&child.signalCode===null)await kill(child);
   try{
    execFileSync('bash',['scripts/s01-t06-start.sh'],{stdio:'pipe',timeout:180000});
    const central=await t06Pool('control_migrator'),deadline=Date.now()+45000;let delivered=false;
    try{while(Date.now()<deadline){
     delivered=(await central.query('SELECT status FROM control.outbox WHERE event_id=$1',[reservation.activatedEventId])).rows[0]?.status==='DELIVERED';
     if(delivered)break;await new Promise(r=>setTimeout(r,250));
    }}finally{await central.end();}
    expect(delivered).toBe(true);
    await expect(audit.service.project(reservation.activatedEventId)).rejects.toThrow();
   }finally{await host.query(`ALTER DATABASE "${database}" ALLOW_CONNECTIONS true`);await host.end();}
  }
  try{
   const deadline=Date.now()+120000;let count=0;
   while(Date.now()<deadline){count=await t07LocalAuditCount(processFixture.agencyId,reservation.activatedEventId);if(count===1)break;await new Promise(r=>setTimeout(r,500));}
   expect(count).toBe(1);
   await audit.service.project(reservation.activatedEventId);await audit.service.project(reservation.activatedEventId);
   expect(await t07LocalAuditCount(processFixture.agencyId,reservation.activatedEventId)).toBe(1);
   expect(await centralView(processFixture)).toMatchObject({state:'ACTIVE',audits:1,outbox:1,idem:1});
   const central=await t06Pool('control_migrator');
   try{
    await expect(central.query('UPDATE control.outbox SET schema_version=2 WHERE event_id=$1',[reservation.activatedEventId]))
     .rejects.toMatchObject({code:'23514',constraint:'outbox_version'});
    await audit.service.project(reservation.activatedEventId);
    expect(await t07LocalAuditCount(processFixture.agencyId,reservation.activatedEventId)).toBe(1);
   }finally{await central.end();}
  }finally{await audit.pool.end();}
 },300000);

 it('rejects anonymous, forbidden roles and platform scope on GET, activation and retry',async()=>{
  const central=await t06Pool('control_migrator'),session=await t07OnboardingSession(authority.subjectId,authority.rootId);
  const {app,base}=await api(new AgenciesService({auth:session.auth}));
  try{
   const own=`${base}/${authority.agencyId}/activation`,other=`${base}/${atomic.agencyId}/activation`;
   expect((await fetch(own)).status).toBe(401);
   const request=await activationRequest(base,authority,session);
   const {Cookie:cookie,...anonymousHeaders}=request.options.headers;expect(cookie).toBe(session.cookie);
   expect((await fetch(own,{...request.options,headers:anonymousHeaders})).status).toBe(401);
   expect((await fetch(`${base}/${authority.agencyId}/provisioning/retry`,{...request.options,headers:anonymousHeaders})).status).toBe(401);
   expect((await fetch(other,{headers:{Cookie:session.cookie}})).status).toBe(404);
   expect((await fetch(own,{...request.options,body:JSON.stringify({agencyId:atomic.agencyId})})).status).toBe(400);
   expect((await fetch(`${base}/${authority.agencyId}/provisioning/retry`,{...request.options,body:JSON.stringify({agencyId:atomic.agencyId})})).status).toBe(400);
   expect((await fetch(own,{...request.options,headers:{...request.options.headers,Origin:'https://forbidden.invalid'}})).status).toBe(403);
   for(const role of ['STANDARD','HABILITED']){
    await central.query('UPDATE identity.membership SET role=$2 WHERE agency_id=$1',[authority.agencyId,role]);
    await assertForbiddenRoutes(authority,session,request.options);
   }
   await central.query("UPDATE identity.membership SET role='ADMIN' WHERE agency_id=$1",[authority.agencyId]);
   for(const url of [other,`${base}/${atomic.agencyId}/provisioning/retry`])expect((await fetch(url,request.options)).status).toBe(404);
   await central.query("UPDATE identity.session SET scope='platform' WHERE subject_id=$1",[authority.subjectId]);
   await assertForbiddenRoutes(authority,session,request.options);
  }finally{
   await central.query("UPDATE identity.membership SET role='ADMIN' WHERE agency_id=$1",[authority.agencyId]);
   await app.close();await session.pool.end();await central.end();
  }
 });

 it('refuses session revocation and native changes during local I/O, then a fsynced J1 deny despite stale SQL',async()=>{
  const audit=await auditService(),central=await t06Pool('control_migrator');
  try{for(const mode of ['session-revoked','absolute-expired','native-session-ended','native-identity-changed','journal-unavailable','journal-denied'] as const){
   let changed=false;
   const session=await t07OnboardingSession(authority.subjectId,authority.rootId,async()=>{
    if(changed&&mode==='native-session-ended')throw new NativeSessionEnded();
    if(changed&&mode==='native-identity-changed')throw new NativeIdentityChanged();
   });
   const head=session.journal.head.bind(session.journal);
   const prepare=async(input:{reservationId:string;eventId:string})=>{
    await audit.service.prepare(input.reservationId,input.eventId);
    if(mode==='session-revoked')await central.query('UPDATE identity.session SET revoked_at=clock_timestamp() WHERE subject_id=$1',[authority.subjectId]);
    if(mode==='absolute-expired')await central.query('UPDATE identity.session SET absolute_expires_at=clock_timestamp() WHERE subject_id=$1',[authority.subjectId]);
    if(mode==='journal-denied'){
     const faulty=new Proxy(session.journal,{get(target,property){if(property==='append')return async(...args:Parameters<AuthorityJournal['append']>)=>{
      const value=await target.append(...args);if(args[1].state==='DENIED')throw new Error('SYNTHETIC_DENY_SQL_LOSS');return value;
     };const value=Reflect.get(target,property);return typeof value==='function'?value.bind(target):value;}});
     await expect(new ControlRepository(central,faulty).deny(authority.subjectId,randomUUID(),async()=>{})).rejects.toThrow('SYNTHETIC_DENY_SQL_LOSS');
    }
   };
   const service=new AgenciesService({auth:session.auth,activationAudit:{prepare,read:async x=>{
    const result=await audit.service.read(x.reservationId,x.eventId);changed=true;
    if(mode==='journal-unavailable')vi.spyOn(session.journal,'head').mockRejectedValue(new Error('SYNTHETIC_J1_UNAVAILABLE'));
    return result;
   }}}),{app,base}=await api(service);
   try{
    const request=await activationRequest(base,authority,session),response=await fetch(request.url,request.options);
    expect(response.status).toBe(mode.startsWith('journal-')?503:401);
    if(mode.startsWith('journal-'))expect(await response.json()).toMatchObject({code:'DEPENDENCY_UNAVAILABLE'});
    expect(await centralView(authority)).toMatchObject({state:'READY',membership:'PENDING',audits:0,outbox:0,idem:0});
    if(mode==='journal-denied'){
     expect((await head(authority.subjectId))?.state).toBe('DENIED');
     expect((await central.query('SELECT status FROM identity.account_authority WHERE subject_id=$1',[authority.subjectId])).rows[0].status).toBe('CONFIRMED');
    }
   }finally{vi.restoreAllMocks();await app.close();await session.pool.end();}
  }}finally{await audit.pool.end();await central.end();}
 });
 it('serializes retry admission at 100, refuses before refresh and permits current-authority replay',async()=>{
  const compose=['compose','--profile','t06','--env-file','.local/compose.env','-f','infra/local/compose.yaml'];
  execFileSync('docker',[...compose,'stop','t06-orchestrator'],{stdio:'pipe',timeout:60000});
  const central=await t06Pool('control_migrator'),own:Fixture[]=[];
  const sessions:Awaited<ReturnType<typeof t07OnboardingSession>>[]=[],servers:Awaited<ReturnType<typeof api>>[]=[];
  const backlog=async()=>Number((await central.query(`SELECT count(*)::int AS n FROM control.agency a JOIN control.provisioning_operation o ON o.agency_id=a.id
   WHERE o.status IN ('PENDING','RUNNING') OR (o.status='FAILED' AND o.retryable)
   OR EXISTS(SELECT 1 FROM control.provisioning_execution e WHERE e.operation_id=o.id AND e.state IN ('RUNNING','BLOCKED'))`)).rows[0].n);
  try{
   for(let n=0;n<2;n++){
    const fixture=await createT07Fixture();own.push(fixture);
    await central.query("UPDATE control.outbox SET status='DELIVERED' WHERE agency_id=$1",[fixture.agencyId]);
    await central.query("UPDATE control.agency SET state='FAILED',version=version+1 WHERE id=$1",[fixture.agencyId]);
    await central.query("UPDATE control.provisioning_operation SET status='FAILED',retryable=true,last_error_code='DEPENDENCY_UNAVAILABLE',version=version+1 WHERE id=$1",[fixture.operationId]);
    const session=await t07OnboardingSession(fixture.subjectId,fixture.rootId);sessions.push(session);
    servers.push(await api(new AgenciesService({auth:session.auth})));
   }
   const commands=await Promise.all(own.map(async(f,n)=>{
    const request=await activationRequest(servers[n]!.base,f,sessions[n]!);
    return {...request,url:`${servers[n]!.base}/${f.agencyId}/provisioning/retry`};
   }));
   const initial=await backlog();expect(initial).toBeLessThan(100);
   for(let n=initial;n<100;n++)own.push(await createT06Fixture(true));
   const before=await Promise.all(sessions.map(s=>s.journal.head(own[sessions.indexOf(s)]!.subjectId)));
   const refreshes=sessions.map(s=>s.refreshSubjects.length);
   const denied=await Promise.all(commands.map(c=>fetch(c.url,c.options)));
   expect(denied.map(r=>r.status)).toEqual([429,429]);
   for(let n=0;n<2;n++){
    expect(denied[n]!.headers.get('retry-after')).toBe('60');
    expect(sessions[n]!.refreshSubjects.length).toBe(refreshes[n]);
    expect(await sessions[n]!.journal.head(own[n]!.subjectId)).toEqual(before[n]);
    expect((await central.query('SELECT state,version::text FROM control.agency WHERE id=$1',[own[n]!.agencyId])).rows[0]).toEqual({state:'FAILED',version:'2'});
   }
   const load=own.at(-1)!;expect(load.agencyId).not.toBe(own[1]!.agencyId);
   await central.query("UPDATE control.agency SET state='FAILED',version=version+1 WHERE id=$1",[load.agencyId]);
   await central.query("UPDATE control.provisioning_operation SET status='FAILED',retryable=false,last_error_code='SYNTHETIC_LOAD_TERMINAL',version=version+1 WHERE id=$1 AND status='PENDING' AND attempt=0",[load.operationId]);
   expect(await backlog()).toBe(99);
   const resumed=await Promise.all(commands.map(c=>fetch(c.url,c.options)));
   expect(resumed.map(r=>r.status)).toEqual([202,202]);expect(await backlog()).toBe(99);
   const audits=await central.query("SELECT count(*)::int AS n FROM control.audit_event WHERE agency_id=ANY($1::uuid[]) AND event_type='agency.provisioning.retried.v1'",[own.slice(0,2).map(f=>f.agencyId)]);
   expect(audits.rows[0].n).toBe(2);
   // Add an owned inert slot: replay still succeeds at saturation, with one durable retry audit.
   own.push(await createT06Fixture(true));expect(await backlog()).toBe(100);
   expect((await fetch(commands[0]!.url,commands[0]!.options)).status).toBe(202);
   expect((await central.query("SELECT count(*)::int AS n FROM control.audit_event WHERE agency_id=$1 AND event_type='agency.provisioning.retried.v1'",[own[0]!.agencyId])).rows[0].n).toBe(1);
  }finally{
   // Retain every fixture and its provenance; finish only our inert attempt-zero load.
   try{for(const fixture of own){
    const row=(await central.query(`SELECT o.attempt,(SELECT count(*)::int FROM control.provisioning_execution e WHERE e.operation_id=o.id) AS executions,
     (SELECT count(*)::int FROM control.database_locator l WHERE l.agency_id=o.agency_id) AS locators FROM control.provisioning_operation o WHERE id=$1`,[fixture.operationId])).rows[0];
    if(!row||row.attempt!==0||row.executions!==0||row.locators!==0)throw new Error('T07_ADMISSION_LOAD_NOT_INERT');
    await central.query("UPDATE control.agency SET state='FAILED',version=version+1 WHERE id=$1 AND activated_at IS NULL",[fixture.agencyId]);
    await central.query("UPDATE control.provisioning_operation SET status='FAILED',retryable=false,last_error_code='SYNTHETIC_LOAD_TERMINAL',version=version+1 WHERE id=$1",[fixture.operationId]);
   }}finally{
    try{for(const server of servers)await server.app.close();for(const session of sessions)await session.pool.end();await central.end();}
    finally{execFileSync('docker',[...compose,'start','t06-orchestrator'],{stdio:'pipe',timeout:60000});}
   }
  }
 },180000);

});
