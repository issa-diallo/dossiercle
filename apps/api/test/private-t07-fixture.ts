import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { randomUUID, createHash, randomBytes } from 'node:crypto';
import { AuthorityJournal } from '@dossiercle/adapters/journal/authority-journal';
import { SessionCipher } from '@dossiercle/adapters/identity/session-cipher';
import { ControlRepository } from '@dossiercle/adapters/postgres/control.repository';
import { t06Pool } from './private-t06-fixture.js';
import { AuthService, SESSION_COOKIE } from '../src/auth/auth.service.js';
import { ActivationRepository } from '@dossiercle/adapters/postgres/activation.repository';
import { FileSecretStore } from '@dossiercle/adapters/secrets/secret-store';
import { Pool } from '@dossiercle/adapters/postgres/runtime-pool';

export function startT07Provisioning(){
  const running=execFileSync('docker',['compose','--profile','t06','--env-file','.local/compose.env','-f','infra/local/compose.yaml',
    'ps','--status','running','--services'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim().split('\n');
  if(!running.includes('t06-provisioner')||!running.includes('t06-orchestrator'))
    execFileSync('bash',['scripts/s01-t06-start.sh'],{stdio:'pipe',timeout:180000});
}

export async function createT07Fixture(){
  const tuple={rootId:randomUUID(),subjectId:randomUUID(),agencyId:randomUUID(),operationId:randomUUID()},eventId=randomUUID();
  execFileSync(process.execPath,['scripts/s01-fixture-manifests.mjs','declare-t07-tuple',JSON.stringify(tuple)],{stdio:'pipe'});
  const pool=await t06Pool('control_migrator'),client=await pool.connect();
  const journal=new AuthorityJournal('.local/journal/application');
  try{
    await client.query('BEGIN');
    await client.query('INSERT INTO identity.account_authority(subject_id) VALUES($1)',[tuple.subjectId]);
    await client.query('SELECT 1 FROM identity.account_authority WHERE subject_id=$1 FOR UPDATE',[tuple.subjectId]);
    const commandId=randomUUID();
    await journal.append(client,{subjectId:tuple.subjectId,commandId,epoch:1n,state:'PENDING'});
    const head=await journal.append(client,{subjectId:tuple.subjectId,commandId,epoch:1n,state:'CONFIRMED'});
    await client.query(`UPDATE identity.account_authority SET status='CONFIRMED',confirmed_epoch=1,journal_sequence=$2,journal_hash=$3,
      enrollment_status='VERIFIED',recovery_ready=true WHERE subject_id=$1`,[tuple.subjectId,head.sequence.toString(),head.hash]);
    await client.query(`INSERT INTO control.agency_invitation(id,root_id,subject_id,contact,owner_id,identity_status,status)
      VALUES($1,$2,$3,$4,$5,'CONFIRMED','CLAIMED')`,[randomUUID(),tuple.rootId,tuple.subjectId,`${tuple.subjectId}@example.invalid`,randomUUID()]);
    await client.query(`INSERT INTO control.agency(id,invitation_root_id,name,canonical_name_hash)
      VALUES($1,$2,'T07 synthetic',$3)`,[tuple.agencyId,tuple.rootId,createHash('sha256').update(tuple.agencyId).digest('hex')]);
    await client.query("INSERT INTO identity.membership(subject_id,agency_id,role) VALUES($1,$2,'ADMIN')",[tuple.subjectId,tuple.agencyId]);
    await client.query('INSERT INTO control.provisioning_operation(id,agency_id) VALUES($1,$2)',[tuple.operationId,tuple.agencyId]);
    await client.query(`INSERT INTO control.idempotency_record(actor_id,operation_type,key,canonical_body_hash,resource_id,result)
      VALUES($1,'t05.agency-create.v1',$2,$3,$4,$5::jsonb)`,[tuple.subjectId,randomUUID(),'0'.repeat(64),tuple.rootId,
        JSON.stringify({agencyId:tuple.agencyId,operationId:tuple.operationId})]);
    await client.query(`INSERT INTO control.audit_event(event_id,agency_id,actor_id,actor_type,event_type,resource_id,outcome,correlation,resource_version)
      VALUES($1,$2,$3,'human','agency.creation-accepted',$4,'accepted',$5,1)`,[eventId,tuple.agencyId,tuple.subjectId,tuple.rootId,tuple.operationId]);
    await client.query(`INSERT INTO control.outbox(event_id,type,agency_id,resource_id,version)
      VALUES($1,'agency.creation-accepted',$2,$3,1)`,[eventId,tuple.agencyId,tuple.rootId]);
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();await pool.end();}
  execFileSync(process.execPath,['scripts/s01-fixture-manifests.mjs','capture'],{stdio:'pipe'});
  return tuple;
}

export async function t07OnboardingSession(subjectId:string,rootId:string,nativeSession:(subject:string,payload:Record<string,unknown>)=>Promise<void>=async()=>{},poolMax=1){
  const env=JSON.parse(await readFile('.local/environment.json','utf8')) as {pgPort:number;private:string;tlsPort:number};
  const pool=await t06Pool('control_coordinator','control',poolMax),journal=new AuthorityJournal('.local/journal/application');
  const origin=`https://localhost:${env.tlsPort}`,owner=randomUUID();
  const refreshSubjects:string[]=[];
  const auth=new AuthService({pool,control:new ControlRepository(pool,journal),journal,
    cipher:new SessionCipher(randomBytes(32),randomBytes(32)),ownerSubject:owner,origin,
    nativeSession,nativeRefresh:async(subject,payload)=>{refreshSubjects.push(subject);return payload;}});
  const client=await pool.connect();let value:string;
  try{
    await client.query('BEGIN');
    value=await auth.issue(client,{subjectId,rootId,scope:'onboarding',epoch:1n,nativePayload:{sid:randomUUID()}});
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
  const cookie=`${SESSION_COOKIE}=${value}`,view=await auth.session(cookie);
  return {auth,pool,journal,origin,cookie,csrf:view.csrfToken,refreshSubjects};
}

export async function awaitT07Ready(fixture:Awaited<ReturnType<typeof createT07Fixture>>){
  const pool=await t06Pool('control_coordinator'),repo=new ActivationRepository(),deadline=Date.now()+240000;
  try{
    while(Date.now()<deadline){
      const client=await pool.connect();
      try{
        await client.query('BEGIN');await client.query('SET LOCAL ROLE control_t07');
        const snapshot=await repo.snapshot(client,fixture.agencyId,fixture.subjectId);
        if(snapshot){
          if(snapshot.state==='FAILED')throw new Error('T07_FIXTURE_PROVISIONING_FAILED');
          try{repo.assertReady(snapshot);return;}catch(error){if(!(error instanceof Error)||error.message!=='NOT_READY')throw error;}
        }
      }finally{await client.query('ROLLBACK');client.release();}
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    throw new Error('T07_FIXTURE_NOT_READY');
  }finally{await pool.end();}
}

export async function t07LocalAuditCount(agencyId:string,eventId:string){
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
