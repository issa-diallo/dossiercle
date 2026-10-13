import type { Page } from '@playwright/test';
import { readFile,rename,stat,writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID,createHash } from 'node:crypto';
import { controlPool } from '../../packages/adapters/dist/postgres/runtime-pool.js';
import { AuthorityJournal } from '../../packages/adapters/dist/journal/authority-journal.js';
const run=promisify(execFile);
/** Reversible, local synthetic failures. No cleanup, key generation or restore of J1 history. */
export async function qualifyNativeFailures(page:Page,subject:string){
 const e=JSON.parse(await readFile('.local/environment.json','utf8')) as {root:string;private:string;project:string;pgPort:number;syntheticOnly:boolean};
 if(!e.syntheticOnly||e.root!==process.cwd())throw new Error('SYNTHETIC_REQUIRED');
 const compose=['compose','--profile','identity-runtime','--env-file','.local/compose.env','-f','infra/local/compose.yaml'];
 const docker=async(args:string[])=>{await run('docker',[...compose,...args],{timeout:150000});};
 const start=async(service:string)=>{await docker(['start',service]);await docker(['up','-d','--wait','--wait-timeout','120',service]);};
 const status=async()=>await page.evaluate(async()=>{try{return (await fetch('/v1/session')).status;}catch{return 0;}});
 let stage='DEPENDENCIES';
 try{
 const origin='https://localhost:'+(JSON.parse(await readFile('.local/environment.json','utf8')) as {tlsPort:number}).tlsPort;
 const bff=(await page.context().cookies(origin)).find(cookie=>cookie.name==='__Host-dossiercle');
 if(!bff)throw new Error('STRONG_COOKIE_REQUIRED');
 const cookieHash=createHash('sha256').update(bff.value).digest('hex');
 const bindingHash=createHash('sha256').update(cookieHash).digest('hex');
 const journal=new AuthorityJournal('.local/journal/application'),before=await journal.head(subject);
 for(const service of ['privacyidea']){
  stage='STOP_'+service.toUpperCase();await docker(['stop',service]);
  try{if(await status()!==503)throw new Error('NATIVE_DEPENDENCY_FAILURE_NOT_CLOSED');}
  finally{await start(service);}
  if(await status()!==200)throw new Error('NATIVE_DEPENDENCY_RECOVERY_NOT_CONFIRMED');
  if((await journal.head(subject))?.hash!==before?.hash)throw new Error('TEMPORARY_FAILURE_CHANGED_AUTHORITY');
 }
 // ENCKEY is a directory bind, unlike a file bind; PI starts with genuinely absent key.
 stage='PI_KEY';
 const key=e.private+'/pi/pi-enckey',retained=key+'.retained-'+randomUUID();
 await docker(['stop','privacyidea']);await rename(key,retained);
 try{
  await docker(['start','privacyidea']);
  await new Promise(resolve=>setTimeout(resolve,1500));
  if(await status()!==503)throw new Error('MISSING_PI_KEY_OPEN');
  try{await stat(key);throw new Error('PI_KEY_REGENERATED');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 }finally{await docker(['stop','privacyidea']);await rename(retained,key);await start('privacyidea');}
 if(await status()!==200)throw new Error('PI_KEY_RECOVERY_CLOSED');
 // A known initialized J1 is never silently regenerated, including across coordinator restart.
 stage='JOURNAL';
 const path=journal.path,history=path+'.retained-'+randomUUID();await rename(path,history);
 try{
  if(await status()!==503)throw new Error('MISSING_JOURNAL_OPEN');
  await docker(['restart','identity-coordinator']);await new Promise(resolve=>setTimeout(resolve,1000));
  if(await status()!==503)throw new Error('JOURNAL_RESTART_OPEN');
  try{await stat(path);throw new Error('JOURNAL_REGENERATED');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 }finally{await rename(history,path);await start('identity-coordinator');}
 if(await status()!==200)throw new Error('JOURNAL_RECOVERY_CLOSED');
 // Redirect config to an absent key without modifying any existing key file.
 stage='SESSION_KEY';
 const configPath=e.private+'/coordinator/config.json',previous=await readFile(configPath,'utf8');
 const replaceConfig=async(value:string)=>{const next=configPath+'.fault-'+randomUUID();await writeFile(next,value,{flag:'wx',mode:0o400});await rename(next,configPath);};
 try{
  const config=JSON.parse(previous) as {sessionEncryptionKeyFile:string};config.sessionEncryptionKeyFile='/run/s01-coordinator/absent-test-key';
  await replaceConfig(JSON.stringify(config));await docker(['restart','identity-coordinator']);await new Promise(resolve=>setTimeout(resolve,1000));
  if(await status()!==503)throw new Error('MISSING_SESSION_KEY_OPEN');
 }finally{await replaceConfig(previous);await start('identity-coordinator');}
 if(await status()!==200)throw new Error('SESSION_KEY_RECOVERY_CLOSED');
 stage='WAF';await docker(['stop','ingress']);
 try{if(await status()!==0)throw new Error('STOPPED_WAF_ROUTE_OPEN');}
 finally{await start('ingress');}
 if(await status()!==200)throw new Error('WAF_RECOVERY_CLOSED');
 if((await journal.head(subject))?.hash!==before?.hash)throw new Error('FAULT_TEST_MUTATED_AUTHORITY');
 // Restart may end the native SSO session. A positively absent SID must stay revoked.
 stage='STOP_KEYCLOAK';await docker(['stop','keycloak']);
 try{if(await status()!==503)throw new Error('NATIVE_DEPENDENCY_FAILURE_NOT_CLOSED');}
 finally{await start('keycloak');}
 const resumed=await status();
 if(resumed===200){
  if((await journal.head(subject))?.hash!==before?.hash)throw new Error('TEMPORARY_FAILURE_CHANGED_AUTHORITY');
 }else if(resumed===401){
  const pool=controlPool({host:'127.0.0.1',port:e.pgPort,role:'control_coordinator',password:(await readFile(e.private+'/pg/control_coordinator','utf8')).trim(),max:1});
  try{
   const revoked=(await pool.query('SELECT count(*)::int AS n FROM identity.session WHERE subject_id=$1 AND cookie_hash=$2 AND revoked_at IS NOT NULL',[subject,cookieHash])).rows[0].n;
   const tombstone=(await pool.query(`SELECT count(*)::int AS n FROM control.idempotency_record s JOIN control.idempotency_record t ON t.key=s.key
    WHERE s.actor_id=$1 AND s.canonical_body_hash=$2 AND s.operation_type='identity.native-session' AND t.operation_type='identity.sid-revoked'`,[subject,bindingHash])).rows[0].n;
   if(revoked<1||tombstone<1||(await journal.head(subject))?.state!=='CONFIRMED')throw new Error('NATIVE_ENDED_SID_NOT_DURABLE');
  }finally{await pool.end();}
 }else if(resumed===503){
  if((await journal.head(subject))?.hash!==before?.hash)throw new Error('TEMPORARY_FAILURE_CHANGED_AUTHORITY');
 }else throw new Error('NATIVE_DEPENDENCY_RECOVERY_NOT_CLOSED');
 return {resumed};

 }catch(error){const value=error as {code?:unknown;message?:unknown};const detail=typeof value.message==='string'&&/^[A-Z_]{1,100}$/.test(value.message)?value.message:typeof value.code==='string'&&/^[A-Z_]{1,30}$/.test(value.code)?value.code:'UNCLASSIFIED';throw new Error('NATIVE_FAULT_'+stage+'_'+detail);}
}
