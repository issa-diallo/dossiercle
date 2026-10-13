import type { PoolClient } from 'pg';
import { assertSchema } from './migrate.js';
export class AgencyRepository {
  async verify(client:PoolClient,agencyId:string):Promise<void> {
    await assertSchema(client,'agency');
    const r=await client.query('SELECT agency_id,schema_version FROM agency_metadata WHERE singleton=true');
    if(r.rows.length!==1||r.rows[0].agency_id!==agencyId||r.rows[0].schema_version!==1)throw new Error('AGENCY_SCHEMA_CLOSED');
    const configuration=await client.query('SELECT automation_enabled,modules_enabled,mail_connected FROM agency_configuration WHERE singleton=true');
    if(configuration.rows.length!==1||Object.values(configuration.rows[0]).some(v=>v!==false))throw new Error('AGENCY_CONFIGURATION_CLOSED');
  }
  async projectAudit(client:PoolClient,event:{eventId:string;eventType:string;version:bigint;correlation:string}):Promise<void> {
    await client.query('INSERT INTO audit_event(event_id,event_type,resource_version,correlation) VALUES($1,$2,$3,$4) ON CONFLICT(event_id) DO NOTHING',[event.eventId,event.eventType,event.version.toString(),event.correlation]);
    const row=(await client.query('SELECT event_type,resource_version::text,correlation FROM audit_event WHERE event_id=$1',[event.eventId])).rows[0];
    if(!row||row.event_type!==event.eventType||row.resource_version!==event.version.toString()||row.correlation!==event.correlation)throw new Error('AUDIT_PROJECTION_CONFLICT');
  }
}
