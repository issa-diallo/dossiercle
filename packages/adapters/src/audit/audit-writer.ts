import type { PoolClient } from 'pg';
export interface AuditIntent {eventId:string;agencyId:string|null;actorId:string;actorType:'human'|'service';eventType:string;resourceId:string;version:bigint;outcome:'accepted'|'denied'|'succeeded';correlation:string;dispatch:boolean}
/** Invoked inside the caller's central transaction with dedicated INSERT capability. */
export async function writeAudit(client:PoolClient,event:AuditIntent,auditRole:string):Promise<void> {
  if(!/^[a-z][a-z0-9_]{0,62}$/.test(auditRole))throw new Error('INVALID_AUDIT_ROLE');
  await client.query(`SET LOCAL ROLE "${auditRole}"`);
  try {
  await client.query('INSERT INTO control.audit_event(event_id,agency_id,actor_id,actor_type,event_type,resource_id,outcome,correlation,resource_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[event.eventId,event.agencyId,event.actorId,event.actorType,event.eventType,event.resourceId,event.outcome,event.correlation,event.version.toString()]);
  if(event.dispatch)await client.query('INSERT INTO control.outbox(event_id,type,agency_id,resource_id,version) VALUES($1,$2,$3,$4,$5)',[event.eventId,event.eventType,event.agencyId,event.resourceId,event.version.toString()]);
  } finally { await client.query('RESET ROLE'); }
}
