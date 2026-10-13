import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
/** Maintained external authenticator simulation. No OTP implementation or seed store in application. */
export async function fixtureOtp(seed:string,offsetSeconds=0):Promise<string>{
  if(! /^[A-Z2-7]+=*$/.test(seed))throw new Error('SYNTHETIC_AUTHENTICATOR_INPUT_INVALID');
  const manifest=JSON.parse(await readFile('infra/local/versions.json','utf8')) as {testTools:Array<{name:string;executablePath?:string;executableSha256?:string}>};
  const tool=manifest.testTools.find(value=>value.name==='oathtool');
  if(!tool?.executablePath||createHash('sha256').update(await readFile(tool.executablePath)).digest('hex')!==tool.executableSha256)throw new Error('SYNTHETIC_AUTHENTICATOR_UNAVAILABLE');
  return await new Promise((resolve,reject)=>{
    const nowArgument=offsetSeconds===0?[]:['--now='+new Date(Date.now()+offsetSeconds*1000).toISOString()];
    const child=spawn(tool.executablePath!,[...nowArgument,'--totp=SHA1','--base32','--time-step-size=30s','--digits=6','-'],{env:{...process.env,LD_LIBRARY_PATH:process.cwd()+'/.local/oath-tools/usr/lib/x86_64-linux-gnu'},stdio:['pipe','pipe','pipe']});
    let output='';child.stdout.on('data',(data:Buffer)=>{output+=data.toString();if(output.length>64)child.kill();});child.stderr.resume();
    child.on('error',()=>reject(new Error('SYNTHETIC_AUTHENTICATOR_UNAVAILABLE')));
    const deadline=setTimeout(()=>child.kill(),3000);child.once('close',code=>{clearTimeout(deadline);const otp=output.trim();if(code!==0||! /^[0-9]{6}$/.test(otp))reject(new Error('SYNTHETIC_AUTHENTICATOR_UNAVAILABLE'));else resolve(otp);});
    // Seed never appears in command arguments, environment, files or reports.
    child.stdin.end(seed+'\n');
  });
}
