import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { controlPool } from '../../packages/adapters/dist/postgres/runtime-pool.js';
import { AuthorityJournal } from '../../packages/adapters/dist/journal/authority-journal.js';
import { KeycloakAdapter } from '../../packages/adapters/dist/identity/keycloak-adapter.js';
import { nativeTransport } from '../../packages/adapters/dist/identity/native-transport.js';

/** Native provider boundary only: one J1 PENDING lock, two native sessions,
 * no coordinator callback, BFF cookie, business grant, snapshot or secret output. */
export async function qualifyConcurrentRecovery(input:{subject:string;root:string;password:string;codes:string[]},kc:KeycloakAdapter){
 const e=JSON.parse(await readFile('.local/environment.json','utf8')) as {root:string;private:string;project:string;pgPort:number;tlsPort:number;syntheticOnly:boolean};
 if(!e.syntheticOnly||e.root!==process.cwd())throw new Error('SYNTHETIC_REQUIRED');
 const networks=JSON.parse((await promisify(execFile)('docker',['inspect','--format','{{json .NetworkSettings.Networks}}',e.project+'-keycloak-1'])).stdout) as Record<string,{IPAddress:string}>;
 const origin='https://localhost:'+e.tlsPort;
 const fetch=nativeTransport({advertisedOrigin:origin,host:networks[e.project+'_private']!.IPAddress,port:8443,serverName:'keycloak',caFile:e.private+'/ca/ca.crt',browserRedirects:true});
 const pool=controlPool({host:'127.0.0.1',port:e.pgPort,role:'control_coordinator',password:(await readFile(e.private+'/pg/control_coordinator','utf8')).trim(),max:1});
 const journal=new AuthorityJournal('.local/journal/application'),client=await pool.connect();
 const nativeBrowser=()=>{
  const jar=new Map<string,string>();
  return async(url:string|URL,body?:URLSearchParams)=>{
   const response=await fetch(url,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/x-www-form-urlencoded',Origin:origin}:{}),Cookie:[...jar].map(([k,v])=>k+'='+v).join('; ')},...(body?{body}: {})});
   for(const value of response.headers.getSetCookie()){
    const pair=value.split(';')[0]!,at=pair.indexOf('='),name=pair.slice(0,at),data=pair.slice(at+1);
    if(!data)jar.delete(name);else jar.set(name,data);
   }
   return response;
  };
 };
 const action=(html:string)=>{
  const value=html.match(/<form\b[^>]*\baction=["']([^"']+)["']/)?.[1];
  if(!value)throw new Error('SYNTHETIC_NATIVE_FORM_ABSENT');
  const url=new URL(value.replaceAll('&amp;','&'),origin);
  if(url.origin!==origin||url.pathname!=='/realms/dossiercle/login-actions/authenticate')throw new Error('SYNTHETIC_NATIVE_FORM_NOT_BOUND');return url;
 };
 const start=async()=>{
  const native=nativeBrowser(),flow=await kc.begin(origin+'/v1/auth/oidc/callback');
  const login=await native(flow.url);if(login.status!==200)throw new Error('SYNTHETIC_NATIVE_LOGIN_CLOSED');
  const challenge=await native(action(await login.text()),new URLSearchParams({username:input.subject,password:input.password}));
  if(challenge.status!==200)throw new Error('SYNTHETIC_NATIVE_RECOVERY_CLOSED');
  const html=await challenge.text();if(!html.includes('id="kc-recovery-code-login-form"'))throw new Error('SYNTHETIC_NATIVE_RECOVERY_ABSENT');
  const number=Number(html.match(/Recovery code #(\d+)/)?.[1]);
  if(!Number.isSafeInteger(number)||number<1||number>input.codes.length)throw new Error('SYNTHETIC_NATIVE_RECOVERY_INDEX');
  return {native,flow,action:action(html),number};
 };
 try{
  await client.query('BEGIN');await client.query('SELECT root_id FROM control.agency_invitation WHERE root_id=$1 FOR SHARE',[input.root]);
  const row=(await client.query('SELECT * FROM identity.account_authority WHERE subject_id=$1 FOR UPDATE',[input.subject])).rows[0];
  const previous=await journal.head(input.subject);
  if(!row||row.status!=='PENDING'||previous?.state!=='PENDING'||previous.hash!==row.journal_hash)throw new Error('SYNTHETIC_AUTHORITY_NOT_PENDING');
  const head=await journal.append(client,{subjectId:input.subject,epoch:BigInt(row.identity_epoch),commandId:randomUUID(),state:'PENDING',actor:{id:input.subject,type:'human'}});
  await client.query('UPDATE identity.account_authority SET journal_sequence=$2,journal_hash=$3 WHERE subject_id=$1',[input.subject,head.sequence.toString(),head.hash]);
  const attempts=await Promise.all([start(),start()]);if(attempts[0]!.number!==attempts[1]!.number)throw new Error('SYNTHETIC_RECOVERY_CHALLENGES_DIFFER');
  const code=input.codes[attempts[0]!.number-1]!.trim();
  const results=await Promise.all(attempts.map(async attempt=>{
   const response=await attempt.native(attempt.action,new URLSearchParams({recoveryCodeInput:code}));
   if(response.status===200)return false;
   const location=response.headers.get('location');if(response.status!==302||!location)throw new Error('SYNTHETIC_NATIVE_RECOVERY_RESULT');
   const verified=await kc.exchange(new URL(location),{verifier:attempt.flow.verifier,state:attempt.flow.state,nonce:attempt.flow.nonce});
   if(verified.subject!==input.subject||verified.acr!=='2')throw new Error('SYNTHETIC_NATIVE_RECOVERY_SUBJECT');return true;
  }));
  const successes=results.filter(Boolean).length;
  if(successes!==1)throw new Error(successes===2?'SYNTHETIC_RECOVERY_DOUBLE_ACCEPTED':'SYNTHETIC_RECOVERY_BOTH_REFUSED');
  const replay=await start();const reused=await replay.native(replay.action,new URLSearchParams({recoveryCodeInput:code}));
  if(reused.status!==200)throw new Error('SYNTHETIC_RECOVERY_REPLAY_OPEN');
  await client.query('SELECT 1');await client.query('COMMIT');
  return {attempts:2,successes:1,replayRefused:true} as const;
 }catch(error){await client.query('ROLLBACK');const detail=error instanceof Error&&/^[A-Z_]{1,100}$/.test(error.message)?error.message:'UNCLASSIFIED';throw new Error('SYNTHETIC_RECOVERY_BOUNDARY_FAILED_'+detail);}
 finally{client.release();await pool.end();}
}
