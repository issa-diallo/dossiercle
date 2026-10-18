import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { FileSecretStore } from '@dossiercle/adapters/secrets/secret-store';
import { ActivationRepository } from '@dossiercle/adapters/postgres/activation.repository';
import { Pool } from '@dossiercle/adapters/postgres/runtime-pool';
import { t05Hash } from '@dossiercle/adapters/postgres/t05.repository';
import { ActivationAuditService } from '../src/provisioning/activation-audit.service.js';
import { AgenciesService } from '../src/agencies/agencies.service.js';
import { AgenciesModule } from '../src/agencies/agencies.module.js';
import { T05HttpBoundary, sendT05Error } from '../src/http/t05-boundary.js';
import { createT07Fixture, t07OnboardingSession, startT07Provisioning, awaitT07Ready } from './private-t07-fixture.js';
import { t06Pool } from './private-t06-fixture.js';

describe('T07 real PostgreSQL activation authorization and non-ACTIVE gate',()=>{
  it('returns a minimized READY/PROVISIONING view without extending idle activity and refuses activation before refresh',async()=>{
    const fixture=await createT07Fixture(),session=await t07OnboardingSession(fixture.subjectId,fixture.rootId);
    const activationAudit={prepare:vi.fn(async()=>{throw new Error('MUST_NOT_PREPARE');}),read:vi.fn()};
    const agencies=new AgenciesService({auth:session.auth,activationAudit});
    const app=await NestFactory.create(AgenciesModule.register({service:agencies,boundary:new T05HttpBoundary()}),{logger:false,bodyParser:false});
    app.useGlobalFilters({catch(error:unknown,host:{switchToHttp():{getResponse():import('express').Response}}){sendT05Error(error,host.switchToHttp().getResponse());}});
    await app.listen(0,'127.0.0.1');
    try{
      const before=(await session.pool.query('SELECT last_human_activity_at FROM identity.session WHERE subject_id=$1',[fixture.subjectId])).rows[0].last_human_activity_at;
      const address=app.getHttpServer().address() as {port:number};
      const url=`http://127.0.0.1:${address.port}/v1/agencies/${fixture.agencyId}/activation`;
      const get=await fetch(url,{headers:{Cookie:session.cookie}}),view=await get.json() as {agencyId:string;state:string;version:string;canActivate:boolean;canRetry:boolean;automationEnabled:boolean};
      expect(get.status).toBe(200);expect(get.headers.get('cache-control')).toBe('no-store');
      expect(view).toMatchObject({agencyId:fixture.agencyId,state:'PROVISIONING',canActivate:false,canRetry:false,automationEnabled:false});
      const after=(await session.pool.query('SELECT last_human_activity_at FROM identity.session WHERE subject_id=$1',[fixture.subjectId])).rows[0].last_human_activity_at;
      expect(after).toEqual(before);
      const head=await session.journal.head(fixture.subjectId);
      const headers={'Content-Type':'application/json',Origin:session.origin,'X-CSRF-Token':session.csrf,
        'Idempotency-Key':randomUUID(),'If-Match':`"${view.version}"`};
      const refused=await fetch(url,{method:'POST',headers:{...headers,'Cookie':session.cookie},body:'{}'});
      expect(refused.status).toBe(409);expect(await refused.json()).toMatchObject({code:'NOT_READY'});
      const badCsrf=await fetch(url,{method:'POST',headers:{...headers,'Cookie':session.cookie,'X-CSRF-Token':'A'.repeat(43)},body:'{}'});
      expect(badCsrf.status).toBe(403);
      expect(activationAudit.prepare).not.toHaveBeenCalled();
      expect(session.refreshSubjects).toEqual([]);
      expect(await session.journal.head(fixture.subjectId)).toEqual(head);
      expect((await session.pool.query('SELECT state FROM control.agency WHERE id=$1',[fixture.agencyId])).rows[0].state).toBe('PROVISIONING');
      expect((await session.pool.query("SELECT count(*)::int AS n FROM control.audit_event WHERE agency_id=$1 AND event_type='agency.activated.v1'",[fixture.agencyId])).rows[0].n).toBe(0);
    }finally{await app.close();await session.pool.end();}
  });

  it('returns 404 for another root and 403 for a non-ADMIN linked account',async()=>{
    const first=await createT07Fixture(),other=await createT07Fixture();
    const session=await t07OnboardingSession(first.subjectId,first.rootId),agencies=new AgenciesService({auth:session.auth});
    try{
      await expect(agencies.getActivation(session.cookie,other.agencyId)).rejects.toMatchObject({code:'NOT_FOUND'});
      const migration=await t06Pool('control_migrator');
      try{
        await migration.query("UPDATE identity.membership SET role='STANDARD' WHERE subject_id=$1 AND agency_id=$2",[first.subjectId,first.agencyId]);
        await expect(agencies.getActivation(session.cookie,first.agencyId)).rejects.toMatchObject({code:'FORBIDDEN'});
        await migration.query("UPDATE identity.membership SET role='ADMIN' WHERE subject_id=$1 AND agency_id=$2",[first.subjectId,first.agencyId]);
      }finally{await migration.end();}
    }finally{await session.pool.end();}
  });

  it('records human retry without dispatch and lets the scanner reserve the same operation after commit',async()=>{
    const fixture=await createT07Fixture(),central=await t06Pool('control_migrator');
    startT07Provisioning();
    const initialDeadline=Date.now()+240000;let initial:{state:string;status:string}|undefined;
    while(Date.now()<initialDeadline){
      initial=(await central.query(`SELECT a.state,o.status FROM control.agency a JOIN control.provisioning_operation o ON o.agency_id=a.id WHERE a.id=$1`,[fixture.agencyId])).rows[0];
      if(initial?.state==='READY'&&initial.status==='SUCCEEDED')break;
      if(initial?.state==='FAILED')throw new Error('T07_RETRY_FIXTURE_INITIAL_PROVISION_FAILED');
      await new Promise(resolve=>setTimeout(resolve,500));
    }
    expect(initial).toMatchObject({state:'READY',status:'SUCCEEDED'});
    const locatorBefore=(await central.query(`SELECT l.database_name,l.secret_ref,l.migration_role,l.migration_secret_ref FROM control.database_locator l WHERE l.agency_id=$1`,[fixture.agencyId])).rows[0];
    expect(locatorBefore?.database_name).toBeTruthy();expect(locatorBefore?.migration_secret_ref).toBeTruthy();
    const session=await t07OnboardingSession(fixture.subjectId,fixture.rootId);
    const app=await NestFactory.create(AgenciesModule.register({service:new AgenciesService({auth:session.auth}),boundary:new T05HttpBoundary()}),{logger:false,bodyParser:false});
    app.useGlobalFilters({catch(error:unknown,host:{switchToHttp():{getResponse():import('express').Response}}){sendT05Error(error,host.switchToHttp().getResponse());}});
    await app.listen(0,'127.0.0.1');
    let operationVersion:string|undefined;
    try{
      execFileSync('docker',['compose','--profile','t06','--env-file','.local/compose.env','-f','infra/local/compose.yaml','stop','t06-orchestrator'],{stdio:'pipe',timeout:45000});
      // READY can precede the final execution/gate release. Stop new dispatch,
      // then wait for the full readiness barrier before injecting this fixture's failure.
      await awaitT07Ready(fixture);
      await central.query("UPDATE control.agency SET state='FAILED',version=version+1 WHERE id=$1",[fixture.agencyId]);
      await central.query("UPDATE control.provisioning_operation SET step='SECRETS_REFERENCED',status='FAILED',retryable=true,last_error_code='DEPENDENCY_UNAVAILABLE',version=version+1 WHERE id=$1",[fixture.operationId]);
      const address=app.getHttpServer().address() as {port:number},url=`http://127.0.0.1:${address.port}/v1/agencies/${fixture.agencyId}/activation`;
      const current=await fetch(url,{headers:{Cookie:session.cookie}}),view=await current.json() as {version:string;state:string;canRetry:boolean};
      expect(current.status).toBe(200);expect(view).toMatchObject({state:'FAILED',canRetry:true});
      const key=randomUUID(),headers={'Content-Type':'application/json',Origin:session.origin,'X-CSRF-Token':session.csrf,
        Cookie:session.cookie,'Idempotency-Key':key,'If-Match':`"${view.version}"`};
      const retried=await fetch(`http://127.0.0.1:${address.port}/v1/agencies/${fixture.agencyId}/provisioning/retry`,{method:'POST',headers,body:'{}'});
      expect(retried.status).toBe(202);expect(await retried.json()).toMatchObject({agencyId:fixture.agencyId,operationId:fixture.operationId,state:'PROVISIONING'});
      const replay=await fetch(`http://127.0.0.1:${address.port}/v1/agencies/${fixture.agencyId}/provisioning/retry`,{method:'POST',headers,body:'{}'});
      expect(replay.status).toBe(202);expect(await replay.json()).toMatchObject({operationId:fixture.operationId,state:'PROVISIONING'});
      const result=(await central.query(`SELECT a.event_id,o.event_id AS outbox_event,o.type,o.status
        FROM control.audit_event a LEFT JOIN control.outbox o USING(event_id)
        WHERE a.agency_id=$1 AND a.event_type='agency.provisioning.retried.v1'`,[fixture.agencyId])).rows;
      expect(result).toHaveLength(1);expect(result[0]).toMatchObject({outbox_event:null,type:null,status:null});
      operationVersion=(await central.query('SELECT version::text FROM control.provisioning_operation WHERE id=$1',[fixture.operationId])).rows[0].version as string;
    }finally{await app.close();await session.pool.end();execFileSync('docker',['compose','--profile','t06','--env-file','.local/compose.env','-f','infra/local/compose.yaml','start','t06-orchestrator'],{stdio:'pipe',timeout:45000});}
    try{
      const deadline=Date.now()+240000;let wakeup:{event_id:string;operation_id:string;target_attempt:number;status:string}|undefined;
      while(Date.now()<deadline){
        wakeup=(await central.query(`SELECT w.event_id,w.operation_id,w.target_attempt,o.status FROM control.provisioning_wakeup w
          JOIN control.outbox o USING(event_id) WHERE w.operation_id=$1 ORDER BY w.created_at DESC LIMIT 1`,[fixture.operationId])).rows[0];
        if(wakeup?.target_attempt===2&&wakeup.status==='DELIVERED')break;await new Promise(resolve=>setTimeout(resolve,500));
      }
      expect(wakeup).toMatchObject({operation_id:fixture.operationId,target_attempt:2});
      expect(wakeup!.status).toBe('DELIVERED');
      let row:{state:string;status:string;step:string;attempt:number;secret_ref:string|null;database_name:string|null}|undefined;
      const readyDeadline=Date.now()+240000;
      while(Date.now()<readyDeadline){
        row=(await central.query(`SELECT a.state,o.status,o.step,o.attempt,l.secret_ref,l.database_name FROM control.agency a
          JOIN control.provisioning_operation o ON o.agency_id=a.id LEFT JOIN control.database_locator l ON l.agency_id=a.id WHERE a.id=$1`,[fixture.agencyId])).rows[0];
        if(row?.state==='READY'&&row.status==='SUCCEEDED'&&row.step==='READY')break;
        await new Promise(resolve=>setTimeout(resolve,500));
      }
      expect(row).toBeDefined();
      expect(row).toMatchObject({state:'READY',status:'SUCCEEDED',step:'READY',attempt:2});
      expect(row!.database_name).toBe(locatorBefore.database_name);
      const locatorAfter=(await central.query('SELECT migration_role,migration_secret_ref FROM control.database_locator WHERE agency_id=$1',[fixture.agencyId])).rows[0];
      expect(locatorAfter).toEqual({migration_role:locatorBefore.migration_role,migration_secret_ref:locatorBefore.migration_secret_ref});
      expect(row!.secret_ref).toBe(locatorBefore.secret_ref);
      expect(BigInt(operationVersion!)).toBeGreaterThan(0n);
    }finally{await central.end();}
  },420000);

  it('reconciles local prepare and a lost central commit response from durable PostgreSQL records',async()=>{
    const fixture=await createT07Fixture();
    startT07Provisioning();
    const central=await t06Pool('control_migrator');
    const coordinator=await t06Pool('control_coordinator');
    const readyDeadline=Date.now()+240000,repo=new ActivationRepository();let ready=false;
    while(Date.now()<readyDeadline){
      const row=(await central.query('SELECT state FROM control.agency WHERE id=$1',[fixture.agencyId])).rows[0];
      if(row?.state==='FAILED')throw new Error('T07_FIXTURE_PROVISIONING_FAILED');
      if(row?.state==='READY'){
        const check=await coordinator.connect();
        try{
          await check.query('BEGIN');await check.query('SET LOCAL ROLE control_t07');
          const snapshot=await repo.snapshot(check,fixture.agencyId,fixture.subjectId);
          if(snapshot){try{repo.assertReady(snapshot);ready=true;}catch(error){if(!(error instanceof Error)||error.message!=='NOT_READY')throw error;}}
          await check.query('ROLLBACK');
        }finally{check.release();}
        if(ready)break;
      }
      await new Promise(resolve=>setTimeout(resolve,500));
    }
    if(!ready){await coordinator.end();throw new Error('T07_FIXTURE_NOT_READY');}
    const env=JSON.parse(await readFile('.local/environment.json','utf8')) as {private:string;pgPort:number};
    const provisioner=await t06Pool('provisioner');
    const audit=new ActivationAuditService({pool:provisioner,secrets:new FileSecretStore(`${env.private}/t06-migration`),host:'127.0.0.1',port:env.pgPort});
    const tx=await coordinator.connect();let reservation:Awaited<ReturnType<ActivationRepository['reserve']>>;
    try{
      await tx.query('BEGIN');await tx.query('SET LOCAL ROLE control_t07');
      const repo=new ActivationRepository(),snapshot=await repo.snapshot(tx,fixture.agencyId,fixture.subjectId);
      if(!snapshot)throw new Error('T07_FIXTURE_MISSING');
      reservation=await repo.reserve(tx,snapshot);
      await tx.query('COMMIT');
    }catch(error){await tx.query('ROLLBACK').catch(()=>{});throw error;}finally{tx.release();await coordinator.end();}
    await audit.prepare(reservation!.reservationId,reservation!.prepared.eventId);
    await audit.prepare(reservation!.reservationId,reservation!.prepared.eventId);
    expect(await audit.read(reservation!.reservationId,reservation!.prepared.eventId)).toEqual(reservation!.prepared);
    expect(await localAuditCount(fixture.agencyId,reservation!.prepared.eventId)).toBe(1);
    const dry=await t06Pool('control_coordinator'),dryClient=await dry.connect();
    try{
      await dryClient.query('BEGIN');await dryClient.query('SET LOCAL ROLE control_t07');
      const repo=new ActivationRepository(),snapshot=await repo.snapshot(dryClient,fixture.agencyId,fixture.subjectId);
      if(!snapshot)throw new Error('T07_FIXTURE_MISSING');
      await repo.finalize(dryClient,{snapshot,reservation:reservation!,prepared:reservation!.prepared,actorId:fixture.subjectId,
        idempotencyKey:randomUUID(),bodyHash:t05Hash('{}'),correlation:reservation!.prepared.correlation});
      await dryClient.query('ROLLBACK');
    }catch(error){await dryClient.query('ROLLBACK').catch(()=>{});throw error;}
    finally{dryClient.release();await dry.end();}

    const session=await t07OnboardingSession(fixture.subjectId,fixture.rootId);
    const lockPlan={mode:'t07' as const,resolve:async()=>[{rootId:fixture.rootId,subjectId:fixture.subjectId,
      authority:'existing' as const,invitation:'existing' as const}]};
    await session.auth.withT07Session(session.cookie,{origin:session.origin,csrf:session.csrf,humanActivity:true},lockPlan,
      async(client,principal)=>session.auth.revalidateT07(client,principal));
    let authFailure:string|undefined;
    const observedAuth=new Proxy(session.auth,{get(target,property){
      if(property==='withT07Session')return async(...args:unknown[])=>{
        try{return await Reflect.apply(target.withT07Session,target,args);}
        catch(error){authFailure=error instanceof Error?error.message:'UNKNOWN_AUTH_FAILURE';throw error;}
      };
      if(property==='revalidateT07')return async(...args:unknown[])=>{
        if(!expireNextRevalidation)return await Reflect.apply(target.revalidateT07,target,args);
        expireNextRevalidation=false;authOptions.now=()=>new Date(Date.now()+31*60_000);
        try{return await Reflect.apply(target.revalidateT07,target,args);}
        finally{delete authOptions.now;}
      };
      const value=Reflect.get(target,property);return typeof value==='function'?value.bind(target):value;
    }}) as typeof session.auth;
    const authOptions=(session.auth as unknown as {options:{now?:()=>Date}}).options;
    let expireNextRevalidation=false;
    const adapter={
      prepare:vi.fn(async(input:{reservationId:string;eventId:string})=>audit.prepare(input.reservationId,input.eventId)),
      read:vi.fn(async(input:{reservationId:string;eventId:string})=>{
        const result=await audit.read(input.reservationId,input.eventId);
        return result;
      }),
    };
    const losePrepare=adapter.prepare;
    let firstPrepare=true;
    adapter.prepare=vi.fn(async(input)=>{await losePrepare(input);if(firstPrepare){firstPrepare=false;throw new Error('SYNTHETIC_PREPARE_ACK_LOST');}});
    let commits=0;
    const options=(session.auth as unknown as {options:{pool:unknown}}).options;
    const rawPool=options.pool as {connect:()=>Promise<{query:(...args:unknown[])=>Promise<unknown>;release:()=>void}>};
    options.pool=new Proxy(rawPool,{get(target,property){
      if(property==='connect')return async()=>{
        const client=await target.connect();
        return new Proxy(client,{get(connection,key){
          if(key==='query')return async(...args:unknown[])=>{
            const result=await connection.query(...args);
            if(typeof args[0]==='string'&&args[0].trim().toUpperCase()==='COMMIT'&&++commits===5)throw new Error('SYNTHETIC_CENTRAL_COMMIT_ACK_LOST');
            return result;
          };
          const value=Reflect.get(connection,key);return typeof value==='function'?value.bind(connection):value;
        }});
      };
      const value=Reflect.get(target,property);return typeof value==='function'?value.bind(target):value;
    }});
    const agencies=new AgenciesService({auth:observedAuth,activationAudit:adapter});
    const app=await NestFactory.create(AgenciesModule.register({service:agencies,boundary:new T05HttpBoundary()}),{logger:false,bodyParser:false});
    app.useGlobalFilters({catch(error:unknown,host:{switchToHttp():{getResponse():import('express').Response}}){sendT05Error(error,host.switchToHttp().getResponse());}});
    await app.listen(0,'127.0.0.1');
    try{
      const address=app.getHttpServer().address() as {port:number},url=`http://127.0.0.1:${address.port}/v1/agencies/${fixture.agencyId}/activation`;
      const get=await fetch(url,{headers:{Cookie:session.cookie}}),view=await get.json() as {version:string};
      expect(get.status).toBe(200);
      const key=randomUUID(),headers={'Content-Type':'application/json',Origin:session.origin,'X-CSRF-Token':session.csrf,
        Cookie:session.cookie,'Idempotency-Key':key,'If-Match':`"${view.version}"`};
      const preparedLost=await fetch(url,{method:'POST',headers,body:'{}'});
      expect(preparedLost.status).toBe(503);
      expireNextRevalidation=true;
      const commitLost=await fetch(url,{method:'POST',headers,body:'{}'});
      expect(commitLost.status).toBe(401);
      const commitAckLost=await fetch(url,{method:'POST',headers,body:'{}'});
      expect(commitAckLost.status).toBe(503);
      if(adapter.prepare.mock.calls.length!==3)throw new Error(`T07_SECOND_REQUEST_FAILED_BEFORE_PREPARE:${authFailure??'NO_AUTH_ERROR'}:prepare=${adapter.prepare.mock.calls.length}:read=${adapter.read.mock.calls.length}:commits=${commits}`);
      expect(adapter.read).toHaveBeenCalledTimes(2);
      expect((await central.query('SELECT state,activated_at FROM control.agency WHERE id=$1',[fixture.agencyId])).rows[0])
        .toMatchObject({state:'ACTIVE'});
      const current=await fetch(url,{headers:{Cookie:session.cookie}}),active=await current.json() as {state:string;canActivate:boolean;canRetry:boolean};
      expect(current.status).toBe(200);expect(active).toMatchObject({state:'ACTIVE',canActivate:false,canRetry:false});
      const replay=await fetch(url,{method:'POST',headers,body:'{}'}),replayed=await replay.json() as {state:string};
      expect(replay.status).toBe(200);expect(replayed.state).toBe('ACTIVE');
      const counts=(await central.query(`SELECT
        (SELECT count(*)::int FROM identity.membership WHERE agency_id=$1 AND state='ACTIVE' AND role='ADMIN') AS members,
        (SELECT count(*)::int FROM control.audit_event WHERE agency_id=$1 AND event_type='agency.activated.v1') AS audits,
        (SELECT count(*)::int FROM control.outbox WHERE agency_id=$1 AND type='agency.activated.v1') AS outbox,
        (SELECT count(*)::int FROM control.idempotency_record WHERE actor_id=$2 AND operation_type='t07.agency-activation.v1' AND key=$3) AS idem`,
        [fixture.agencyId,fixture.subjectId,key])).rows[0];
      expect(counts).toEqual({members:1,audits:1,outbox:1,idem:1});
      const projectionDeadline=Date.now()+90000;
      let projected=0;
      while(Date.now()<projectionDeadline&&projected!==1){
        projected=await localAuditCount(fixture.agencyId,reservation!.activatedEventId).catch(()=>0);
        if(projected!==1)await new Promise(resolve=>setTimeout(resolve,1000));
      }
      expect(projected).toBe(1);
    }finally{await app.close();await session.pool.end();await provisioner.end();await central.end();}
  },360000);
});

async function localAuditCount(agencyId:string,eventId:string){
  const env=JSON.parse(await readFile('.local/environment.json','utf8')) as {private:string;pgPort:number};
  const control=await t06Pool('control_migrator');
  try{
    const locator=(await control.query('SELECT o.id AS operation_id,l.database_name,l.migration_role,l.migration_secret_ref FROM control.provisioning_operation o JOIN control.database_locator l ON l.agency_id=o.agency_id WHERE o.agency_id=$1',[agencyId])).rows[0];
    const password=await new FileSecretStore(`${env.private}/t06-migration`).read({agencyId,operationId:locator.operation_id,secretRef:locator.migration_secret_ref,version:1,kind:'migration'});
    const local=new Pool({host:'127.0.0.1',port:env.pgPort,database:locator.database_name,user:locator.migration_role,password:password.toString(),max:1});
    try{return (await local.query('SELECT count(*)::int AS n FROM audit_event WHERE event_id=$1',[eventId])).rows[0].n as number;}
    finally{await local.end();password.fill(0);}
  }finally{await control.end();}
}
