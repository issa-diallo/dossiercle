import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { writeAudit } from '../audit/audit-writer.js';
export class T05Closed extends Error {constructor(readonly code:string){super(code);}}
export const t05Hash=(value:string):string=>createHash('sha256').update(value).digest('hex');
export interface InvitationRow {id:string;root_id:string;subject_id:string;owner_id:string;contact:string;recovery_channel_ref:string|null;
  identity_status:string;status:string;version:string;token_hash:string|null;expires_at:Date|null}
export const invitationView=(row:InvitationRow)=>({invitationId:row.id,status:row.status,version:row.version});
export async function invitationById(client:PoolClient,id:string):Promise<InvitationRow|null>{
  return (await client.query<InvitationRow>('SELECT * FROM control.agency_invitation WHERE id=$1',[id])).rows[0]??null;
}
export async function requireInvitation(client:PoolClient,id:string):Promise<InvitationRow>{
  const row=await invitationById(client,id);if(!row)throw new T05Closed('NOT_FOUND');return row;
}
export async function readT05Record<T>(client:PoolClient,actor:string,operation:string,key:string,bodyHash?:string):Promise<T|null>{
  const row=(await client.query<{canonical_body_hash:string;result:T}>('SELECT canonical_body_hash,result FROM control.idempotency_record WHERE actor_id=$1 AND operation_type=$2 AND key=$3',[actor,operation,key])).rows[0];
  if(row&&bodyHash!==undefined&&row.canonical_body_hash!==bodyHash)throw new T05Closed('IDEMPOTENCY_CONFLICT');
  return row?.result??null;
}
export async function putT05Record(client:PoolClient,actor:string,operation:string,key:string,bodyHash:string,root:string,result:unknown){
  await client.query('INSERT INTO control.idempotency_record(actor_id,operation_type,key,canonical_body_hash,resource_id,result) VALUES($1,$2,$3,$4,$5,$6)',[actor,operation,key,bodyHash,root,JSON.stringify(result)]);
}
export async function t05Audit(client:PoolClient,input:{actor:string;root:string;type:string;version:bigint;eventId?:string;agencyId?:string;dispatch?:boolean}){
  await writeAudit(client,{eventId:input.eventId??randomUUID(),agencyId:input.agencyId??null,actorId:input.actor,actorType:'human',eventType:input.type,
    resourceId:input.root,version:input.version,outcome:'accepted',correlation:randomUUID(),dispatch:input.dispatch??true},'control_audit');
}
export async function refuseActive(client:PoolClient,root:string){
  if((await client.query("SELECT 1 FROM control.agency WHERE invitation_root_id=$1 AND state='ACTIVE'",[root])).rowCount)throw new T05Closed('CREATION_CONFLICT');
}
