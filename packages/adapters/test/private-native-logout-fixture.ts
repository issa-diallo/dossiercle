import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import { UUID } from '@dossiercle/contracts';
import { nativeTransport } from '../src/identity/native-transport.js';

/** Unsolicited OP logout fixture, using maintained private Keycloak admin REST.
 * No browser bypass, token forgery or application grant. Only synthetic accounts. */
export async function triggerSyntheticNativeLogout(subject:string){
 UUID.parse(subject);
 const e=JSON.parse(await readFile('.local/environment.json','utf8')) as {root:string;private:string;project:string;pgPort:number;tlsPort:number;syntheticOnly:boolean};
 if(!e.syntheticOnly||e.root!==process.cwd())throw new Error('SYNTHETIC_REQUIRED');
 const pool=new Pool({host:'127.0.0.1',port:e.pgPort,database:'control',user:'control_coordinator',password:(await readFile(e.private+'/pg/control_coordinator','utf8')).trim(),max:1});
 try{
  const invitation=(await pool.query('SELECT contact FROM control.agency_invitation WHERE subject_id=$1',[subject])).rows;
  if(invitation.length!==1||!String(invitation[0].contact).endsWith('@example.invalid'))throw new Error('SYNTHETIC_NATIVE_SUBJECT_REQUIRED');
  const networks=JSON.parse((await promisify(execFile)('docker',['inspect','--format','{{json .NetworkSettings.Networks}}',e.project+'-keycloak-1'])).stdout) as Record<string,{IPAddress:string}>;
  const origin='https://localhost:'+e.tlsPort;
  const fetch=nativeTransport({advertisedOrigin:origin,host:networks[e.project+'_private']!.IPAddress,port:8443,serverName:'keycloak',caFile:e.private+'/ca/ca.crt'});
  const auth=await fetch(origin+'/realms/master/protocol/openid-connect/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:'s01-bootstrap',client_secret:(await readFile(e.private+'/kc/bootstrap-client-secret','utf8')).trim()})});
  if(auth.status!==200)throw new Error('SYNTHETIC_NATIVE_LOGOUT_CLOSED');
  const token=(await auth.json() as {access_token:string}).access_token;
  const result=await fetch(origin+'/admin/realms/dossiercle/users/'+subject+'/logout',{method:'POST',headers:{Authorization:'Bearer '+token}});
  if(result.status!==204)throw new Error('SYNTHETIC_NATIVE_LOGOUT_CLOSED');
  const revoked=(await pool.query('SELECT count(*)::int AS n FROM identity.session WHERE subject_id=$1 AND revoked_at IS NOT NULL',[subject])).rows[0].n as number;
  const receipt=(await pool.query("SELECT count(*)::int AS n FROM control.idempotency_record WHERE actor_id=$1 AND operation_type='identity.backchannel.logout'",[subject])).rows[0].n as number;
  if(revoked<1||receipt<1)throw new Error('SYNTHETIC_NATIVE_BACKCHANNEL_NOT_PERSISTED');
  return {nativeLogout:204,durableReceipt:true,bffRevoked:true} as const;
 }catch(error){const detail=error instanceof Error&&/^[A-Z_]{1,100}$/.test(error.message)?error.message:'UNCLASSIFIED';throw new Error('SYNTHETIC_NATIVE_LOGOUT_FAILED_'+detail);}
 finally{await pool.end();}
}

/** Reversible native account mutation for the independent denial/restore test only. */
export async function setSyntheticNativeEnabled(subject:string,enabled:boolean){
 UUID.parse(subject);
 const e=JSON.parse(await readFile('.local/environment.json','utf8')) as {root:string;private:string;project:string;tlsPort:number;syntheticOnly:boolean};
 if(!e.syntheticOnly||e.root!==process.cwd())throw new Error('SYNTHETIC_REQUIRED');
 const networks=JSON.parse((await promisify(execFile)('docker',['inspect','--format','{{json .NetworkSettings.Networks}}',e.project+'-keycloak-1'])).stdout) as Record<string,{IPAddress:string}>;
 const origin='https://localhost:'+e.tlsPort;
 const fetch=nativeTransport({advertisedOrigin:origin,host:networks[e.project+'_private']!.IPAddress,port:8443,serverName:'keycloak',caFile:e.private+'/ca/ca.crt'});
 const auth=await fetch(origin+'/realms/master/protocol/openid-connect/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:'s01-bootstrap',client_secret:(await readFile(e.private+'/kc/bootstrap-client-secret','utf8')).trim()})});
 if(auth.status!==200)throw new Error('SYNTHETIC_NATIVE_MUTATION_CLOSED');
 const token=(await auth.json() as {access_token:string}).access_token;
 const url=origin+'/admin/realms/dossiercle/users/'+subject,headers={Authorization:'Bearer '+token};
 const result=await fetch(url,{headers});if(!result.ok)throw new Error('SYNTHETIC_NATIVE_MUTATION_CLOSED');
 const user=await result.json() as {id:string;username:string;email:string};
 if(user.id!==subject||user.username!==subject||user.email!==subject+'@example.invalid')throw new Error('SYNTHETIC_NATIVE_SUBJECT_REQUIRED');
 const changed=await fetch(url,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({enabled})});
 if(changed.status!==204)throw new Error('SYNTHETIC_NATIVE_MUTATION_CLOSED');
}

export async function syntheticNativeFailureStatus(subject:string){
 UUID.parse(subject);
 const e=JSON.parse(await readFile('.local/environment.json','utf8')) as {root:string;private:string;project:string;tlsPort:number;syntheticOnly:boolean};
 if(!e.syntheticOnly||e.root!==process.cwd())throw new Error('SYNTHETIC_REQUIRED');
 const networks=JSON.parse((await promisify(execFile)('docker',['inspect','--format','{{json .NetworkSettings.Networks}}',e.project+'-keycloak-1'])).stdout) as Record<string,{IPAddress:string}>;
 const origin='https://localhost:'+e.tlsPort;
 const fetch=nativeTransport({advertisedOrigin:origin,host:networks[e.project+'_private']!.IPAddress,port:8443,serverName:'keycloak',caFile:e.private+'/ca/ca.crt'});
 const auth=await fetch(origin+'/realms/master/protocol/openid-connect/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:'s01-bootstrap',client_secret:(await readFile(e.private+'/kc/bootstrap-client-secret','utf8')).trim()})});
 if(!auth.ok)throw new Error('SYNTHETIC_NATIVE_READBACK_CLOSED');
 const token=(await auth.json() as {access_token:string}).access_token;
 const response=await fetch(origin+'/admin/realms/dossiercle/attack-detection/brute-force/users/'+subject,{headers:{Authorization:'Bearer '+token}});
 if(!response.ok)throw new Error('SYNTHETIC_NATIVE_READBACK_CLOSED');
 const value=await response.json() as {disabled:boolean;numFailures:number};
 return {disabled:value.disabled,failures:value.numFailures};
}

export async function resetSyntheticNativePassword(subject:string,password:string){
 UUID.parse(subject);
 const e=JSON.parse(await readFile('.local/environment.json','utf8')) as {root:string;private:string;project:string;tlsPort:number;syntheticOnly:boolean};
 if(!e.syntheticOnly||e.root!==process.cwd()||password.length<12)throw new Error('SYNTHETIC_REQUIRED');
 const networks=JSON.parse((await promisify(execFile)('docker',['inspect','--format','{{json .NetworkSettings.Networks}}',e.project+'-keycloak-1'])).stdout) as Record<string,{IPAddress:string}>;
 const origin='https://localhost:'+e.tlsPort;
 const fetch=nativeTransport({advertisedOrigin:origin,host:networks[e.project+'_private']!.IPAddress,port:8443,serverName:'keycloak',caFile:e.private+'/ca/ca.crt'});
 const auth=await fetch(origin+'/realms/master/protocol/openid-connect/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:'s01-bootstrap',client_secret:(await readFile(e.private+'/kc/bootstrap-client-secret','utf8')).trim()})});
 if(!auth.ok)throw new Error('SYNTHETIC_NATIVE_MUTATION_CLOSED');
 const token=(await auth.json() as {access_token:string}).access_token,headers={Authorization:'Bearer '+token};
 const url=origin+'/admin/realms/dossiercle/users/'+subject;
 const check=await fetch(url,{headers});if(!check.ok)throw new Error('SYNTHETIC_NATIVE_MUTATION_CLOSED');
 const user=await check.json() as {id:string;username:string;email:string};
 if(user.id!==subject||user.username!==subject||user.email!==subject+'@example.invalid')throw new Error('SYNTHETIC_NATIVE_SUBJECT_REQUIRED');
 const result=await fetch(url+'/reset-password',{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({type:'password',temporary:false,value:password})});
 if(result.status!==204)throw new Error('SYNTHETIC_NATIVE_MUTATION_CLOSED');
}
