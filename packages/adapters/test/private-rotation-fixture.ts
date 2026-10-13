import { Pool } from 'pg';
import { readFile,writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { AuthorityJournal } from '../dist/journal/authority-journal.js';
import { fixtureOtp } from '../../../tests/auth/private-otp-fixture.js';
async function privateCommand(args:string[],input:string|Buffer){
 return await new Promise<Buffer>((resolve,reject)=>{
  const child=spawn('docker',args,{stdio:['pipe','pipe','pipe']});const buffers:Buffer[]=[];let size=0;
  child.stdout.on('data',(data:Buffer)=>{size+=data.length;if(size>64*1024*1024)child.kill();else buffers.push(data);});let safeDetail='CLOSED';let tail='';child.stderr.on('data',(data:Buffer)=>{tail=(tail+data.toString()).slice(-1000);const matches=[...tail.matchAll(/AssertionError: ([A-Z_]{1,100})/g)];const kinds=[...tail.matchAll(/\n([A-Za-z]+Error):/g)];if(matches.length)safeDetail=matches.at(-1)![1]!;else if(kinds.length)safeDetail=kinds.at(-1)![1]!.toUpperCase();});
  const deadline=setTimeout(()=>child.kill(),180000);
  child.once('error',()=>{clearTimeout(deadline);reject(new Error('SYNTHETIC_PRIVATE_COMMAND_CLOSED'));});
  child.once('close',code=>{clearTimeout(deadline);if(code!==0)reject(new Error('SYNTHETIC_PRIVATE_COMMAND_'+safeDetail));else resolve(Buffer.concat(buffers));});
  child.stdin.on('error',()=>{});child.stdin.end(input);
 });
}
/** Copy ciphertext to an independent database/credential; rotate only that closed synthetic fixture. */
export async function qualifySyntheticRotation(subject:string,seed:string,usedOtp:string,enrollmentCounter:number){
 const e=JSON.parse(await readFile('.local/environment.json','utf8')) as {root:string;private:string;project:string;pgPort:number;syntheticOnly:boolean};
 if(!e.syntheticOnly||e.root!==process.cwd()||(await new AuthorityJournal('.local/journal/application').head(subject))?.state!=='DENIED')throw new Error('CLOSED_SYNTHETIC_ROTATION_REQUIRED');
 const secret=async(path:string)=>(await readFile(e.private+'/'+path,'utf8')).trim();
 let stage='DATABASE';
 try{
 const suffix=randomBytes(8).toString('hex'),role='s01_rotation_'+suffix,database=role,password=randomBytes(32).toString('hex');
 await writeFile(e.private+'/pg/'+role,password,{mode:0o400,flag:'wx'});
 const admin=new Pool({host:'127.0.0.1',port:e.pgPort,database:'postgres',user:'synthetic_bootstrap',password:await secret('pg/bootstrap'),max:1});
 try{
  await admin.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD '${password}'`);
  await admin.query(`CREATE DATABASE ${database} OWNER ${role} ALLOW_CONNECTIONS false`);
  await admin.query(`REVOKE CONNECT,TEMP ON DATABASE ${database} FROM PUBLIC`);
  await admin.query(`GRANT CONNECT ON DATABASE ${database} TO ${role}`);
  await admin.query(`ALTER DATABASE ${database} ALLOW_CONNECTIONS true`);
 }finally{await admin.end();}
 const container=e.project+'-postgres-1';
 stage='PI_DUMP';const dump=await privateCommand(['exec','-i',container,'sh','-ec','IFS= read -r PGPASSWORD; export PGPASSWORD; exec pg_dump -h 127.0.0.1 -U pi --no-owner --no-acl privacyidea'],await secret('pg/pi')+'\n');
 const seedHex=(await privateCommand(['exec','-i',e.project+'-privacyidea-1','python','-c','import sys,base64;sys.stdout.write(base64.b32decode(sys.stdin.read().strip()).hex())'],seed)).toString();
 const enckey=await readFile(e.private+'/pi/pi-enckey');
 if(dump.includes(seed)||dump.includes(seedHex)||dump.includes(Buffer.from(seedHex,'hex'))||dump.includes(enckey)||dump.includes(enckey.toString('hex'))||dump.includes(enckey.toString('base64')))throw new Error('PI_DUMP_CONTAINS_PLAINTEXT_SECRET');
 stage='PI_IMPORT';await privateCommand(['exec','-i',container,'sh','-ec',`IFS= read -r PGPASSWORD; export PGPASSWORD; exec psql -X -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -U ${role} ${database}`],Buffer.concat([Buffer.from(password+'\n'),dump]));
 stage='KC_DUMP';const kcDump=await privateCommand(['exec','-i',container,'sh','-ec','IFS= read -r PGPASSWORD; export PGPASSWORD; exec pg_dump -h 127.0.0.1 -U kc --no-owner --no-acl keycloak'],await secret('pg/kc')+'\n');
 if(kcDump.includes(seed)||kcDump.includes(seedHex)||kcDump.includes(Buffer.from(seedHex,'hex'))||kcDump.includes(enckey)||kcDump.includes(enckey.toString('hex'))||kcDump.includes(enckey.toString('base64')))throw new Error('KC_DUMP_CONTAINS_TOTP_SECRET');
 const rotationContainer=e.project+'-rotation-'+suffix;
 stage='RAM_CONTAINER';
 await privateCommand(['run','-d','--name',rotationContainer,'--network',e.project+'_private','--memory','512m','--memory-swap','512m','--read-only','--log-driver','none','--security-opt','no-new-privileges:true','--user',String(process.getuid?.()??1000),
  '--tmpfs','/etc/privacyidea:rw,nosuid,nodev,noexec,size=64k','--tmpfs','/tmp:rw,nosuid,nodev,noexec,size=16m','--tmpfs','/dev/shm:rw,nosuid,nodev,noexec,size=16m',
  '--mount','type=bind,source='+e.private+'/pi,target=/run/s01-secrets,readonly',
  '--mount','type=bind,source='+e.private+'/pi-tls,target=/run/s01-tls,readonly',
  e.project+'-privacyidea:3.14','python','-c','import time; time.sleep(36000)'],'');
 const script=await readFile('tests/auth/private-rotation-fixture.py','utf8');
 // Copy only test code via stdin. It contains no fixture values or generated credentials.
 const fixturePath='/dev/shm/s01-rotation-fixture-'+suffix+'.py';
 await privateCommand(['exec','-i',rotationContainer,'python','-c',`import sys,os;os.umask(0o077);open('${fixturePath}','x').write(sys.stdin.read())`],script);
 stage='FRESH_OTP';
 for(let attempt=0;Math.floor(Date.now()/30000)<enrollmentCounter+2&&attempt<130;attempt++)await new Promise(resolve=>setTimeout(resolve,500));
 if(Math.floor(Date.now()/30000)<enrollmentCounter+2)throw new Error('FRESH_OTP_PERIOD_TIMEOUT');
 stage='JANITOR';const result=await privateCommand(['exec','-i',rotationContainer,'python',fixturePath],JSON.stringify({database,role,password,subject,seed,usedOtp,freshOtp:await fixtureOtp(seed),resolverSecret:await secret('kc/client-s01-resolver')}));
 const evidence=JSON.parse(result.toString()) as Record<string,boolean>;
 if(Object.values(evidence).some(value=>value!==true)||Object.keys(evidence).length!==8)throw new Error('SYNTHETIC_ROTATION_NOT_QUALIFIED');
 return {...evidence,piDumpCiphertextOnly:true,keycloakDumpWithoutSeed:true};
 }catch(error){const message=error instanceof Error&&/^[A-Z_]{1,130}$/.test(error.message)?error.message:'CLOSED';throw new Error('ROTATION_'+stage+'_'+message);}
}
