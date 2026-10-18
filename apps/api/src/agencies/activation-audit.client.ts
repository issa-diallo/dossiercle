import { request } from 'node:https';
import type { PreparedAudit } from '@dossiercle/adapters/postgres/activation.repository';
import { z } from 'zod';
const tuple=z.strictObject({eventId:z.uuid(),eventType:z.literal('agency.activation.prepared.v1'),version:z.string().regex(/^[1-9][0-9]*$/),correlation:z.uuid()});
const ack=z.strictObject({prepared:z.literal(true)});
/** Fixed-host, fixed-route mTLS client. Public request fields never enter this transport. */
export class ActivationAuditClient {
  constructor(private readonly tls:{ca:Buffer;cert:Buffer;key:Buffer}){}
  async prepare(input:{reservationId:string;eventId:string}):Promise<void>{ack.parse(await this.send('/internal/t07/activation/prepare',input));}
  async read(input:{reservationId:string;eventId:string}):Promise<PreparedAudit>{return tuple.parse(await this.send('/internal/t07/activation/read',input));}
  private async send(path:string,body:unknown):Promise<unknown>{
    const bytes=Buffer.from(JSON.stringify(body));
    return await new Promise((resolve,reject)=>{
      const req=request({host:'t06-provisioner',port:4443,servername:'t06-provisioner',method:'POST',path,
        ca:this.tls.ca,cert:this.tls.cert,key:this.tls.key,rejectUnauthorized:true,minVersion:'TLSv1.2',
        headers:{Host:'t06-provisioner:4443','Content-Type':'application/json','Content-Length':bytes.byteLength},
        timeout:7000,agent:false},res=>{
        const chunks:Buffer[]=[];let size=0;
        res.on('data',chunk=>{size+=Buffer.byteLength(chunk);if(size>4096){req.destroy(new Error('ACTIVATION_AUDIT_RESPONSE_TOO_LARGE'));return;}chunks.push(Buffer.from(chunk));});
        res.on('end',()=>{try{if(res.statusCode!==200||res.headers['content-type']!=='application/json')throw new Error('ACTIVATION_AUDIT_UNAVAILABLE');resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch(error){reject(error);}});
      });
      req.once('timeout',()=>req.destroy(new Error('ACTIVATION_AUDIT_TIMEOUT')));req.once('error',reject);req.end(bytes);
    });
  }
}
