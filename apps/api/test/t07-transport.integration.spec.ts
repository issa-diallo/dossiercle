import { readFile } from 'node:fs/promises';
import { request } from 'node:https';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { provisionerServer } from '../src/provisioning/provisioner.server.js';

const env=JSON.parse(await readFile('.local/environment.json','utf8')) as {root:string;private:string;syntheticOnly:boolean};
if(!env.syntheticOnly||env.root!==process.cwd())throw new Error('SYNTHETIC_REQUIRED');
const priv=env.private;
const server=provisionerServer({wake:vi.fn(async()=>({operationId:null,disposition:'ignored'}))} as never,{
  key:await readFile(`${priv}/t06-provisioner-tls/server.key`),cert:await readFile(`${priv}/t06-provisioner-tls/server.crt`),
  ca:await readFile(`${priv}/ca/ca.crt`),
},undefined,{
  prepare:vi.fn(async()=>{}),read:vi.fn(async(reservationId:string,eventId:string)=>({eventId,eventType:'agency.activation.prepared.v1',version:'2',correlation:reservationId})),
  project:vi.fn(async()=>{}),
} as never);
let port:number;
beforeAll(async()=>{await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});port=(server.address() as {port:number}).port;});
afterAll(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));});
const tuple={reservationId:'11111111-1111-4111-8111-111111111111',eventId:'22222222-2222-4222-8222-222222222222'};
async function post(path:string,body:unknown,identity:'activation'|'orchestrator'='activation',host='t06-provisioner:4443',contentType='application/json'){
  const base=identity==='activation'?`${priv}/t07-activation-tls`:`${priv}/t06-orchestrator-tls`;
  const ca=await readFile(`${priv}/ca/ca.crt`);
  const cert=await readFile(`${base}/${identity==='activation'?'client.crt':'server.crt'}`);
  const key=await readFile(`${base}/${identity==='activation'?'client.key':'server.key'}`);
  const bytes=Buffer.from(JSON.stringify(body));
  return await new Promise<{status:number;body:unknown}>((resolve,reject)=>{
    const req=request({host:'127.0.0.1',port,servername:'t06-provisioner',method:'POST',path,
      ca,cert,key,
      rejectUnauthorized:true,headers:{Host:host,'Content-Type':contentType,'Content-Length':bytes.length},timeout:3000},res=>{
      const chunks:Buffer[]=[];res.on('data',chunk=>chunks.push(Buffer.from(chunk)));res.on('end',()=>{
        const raw=Buffer.concat(chunks).toString();let parsed:unknown=raw;try{parsed=JSON.parse(raw);}catch{/* keep bounded body text */}
        resolve({status:res.statusCode??0,body:parsed});
      });
    });
    req.once('error',reject);req.end(bytes);
  });
}

describe('T07 private activation HTTP/mTLS boundary',()=>{
  it('accepts only strict prepare/read commands from the dedicated activation client',async()=>{
    const prepared=await post('/internal/t07/activation/prepare',tuple);
    expect(prepared).toEqual({status:200,body:{prepared:true}});
    const readback=await post('/internal/t07/activation/read',tuple);
    expect(readback).toEqual({status:200,body:{eventId:tuple.eventId,eventType:'agency.activation.prepared.v1',version:'2',correlation:tuple.reservationId}});
    expect(await post('/internal/t06/wake',{eventId:tuple.eventId})).toMatchObject({status:403});
    expect(await post('/internal/t07/activation/prepare',{...tuple,dsn:'postgres://forbidden'})).toMatchObject({status:400});
  });
  it('refuses wrong identities, Host, content type, and route substitutions',async()=>{
    expect(await post('/internal/t07/activation/prepare',tuple,'orchestrator')).toMatchObject({status:403});
    expect(await post('/internal/t07/activation/prepare',tuple,'activation','localhost:4443')).toMatchObject({status:403});
    expect(await post('/internal/t07/activation/prepare',tuple,'activation','t06-provisioner:4443','text/plain')).toMatchObject({status:403});
    expect(await post('/internal/t07/activation/prepare?other=1',tuple)).toMatchObject({status:403});
  });
  it('allows only the orchestrator identity to request local activated projection',async()=>{
    expect(await post('/internal/t07/activation/project',{eventId:tuple.eventId},'orchestrator'))
      .toEqual({status:200,body:{projected:true}});
    expect(await post('/internal/t07/activation/project',{eventId:tuple.eventId},'activation'))
      .toMatchObject({status:403});
  });
});
