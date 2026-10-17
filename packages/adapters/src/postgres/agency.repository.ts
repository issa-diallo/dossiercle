import type { PoolClient } from 'pg';
import { assertSchema } from './migrate.js';
export class AgencyRepository {
  async verify(client:PoolClient,agencyId:string):Promise<void> {
    await assertSchema(client,'agency');
    const r=await client.query('SELECT agency_id,schema_version,migration_checksum FROM agency_metadata WHERE singleton=true');
    if(r.rows.length!==1||r.rows[0].agency_id!==agencyId||r.rows[0].schema_version!==1)throw new Error('AGENCY_SCHEMA_CLOSED');
    const ledger=(await client.query('SELECT checksum,owner_id FROM s01_migration.version WHERE singleton=true')).rows[0];
    if(!ledger||ledger.owner_id!==agencyId||ledger.checksum!==r.rows[0].migration_checksum)throw new Error('AGENCY_CHECKSUM_CLOSED');
    const configuration=await client.query('SELECT automation_enabled,modules_enabled,mail_connected FROM agency_configuration WHERE singleton=true');
    if(configuration.rows.length!==1||Object.values(configuration.rows[0]).some(v=>v!==false))throw new Error('AGENCY_CONFIGURATION_CLOSED');
  }
  async verifyRuntimeAcl(client:PoolClient,runtimeRole:string,migrationRole:string):Promise<void>{
    const row=(await client.query(`SELECT current_database() AS database,
      has_database_privilege($1,current_database(),'CONNECT') AS connect,
      has_database_privilege($1,current_database(),'CREATE') AS create_db,
      has_database_privilege($1,current_database(),'TEMP') AS temp,
      has_schema_privilege($1,'public','CREATE') AS create_public,
      has_schema_privilege($1,'business','USAGE') AS business_usage,
      has_schema_privilege($1,'business','CREATE') AS business_create,
      (has_table_privilege($1,'agency_metadata','INSERT') OR has_table_privilege($1,'agency_metadata','UPDATE') OR has_table_privilege($1,'agency_metadata','DELETE')) AS metadata_update,
      (has_table_privilege($1,'agency_configuration','INSERT') OR has_table_privilege($1,'agency_configuration','UPDATE') OR has_table_privilege($1,'agency_configuration','DELETE')) AS configuration_update,
      (has_table_privilege($1,'audit_event','INSERT') OR has_table_privilege($1,'audit_event','UPDATE') OR has_table_privilege($1,'audit_event','DELETE')) AS audit_insert,
      (SELECT nspowner::regrole::text FROM pg_namespace WHERE nspname='business') AS business_owner,
      (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='business' AND c.relkind IN ('r','p','S','v','m','f')
          AND NOT(c.relname=ANY($3::text[]) AND c.relowner=$2::regrole)) AS business_objects`,[runtimeRole,migrationRole,[`t06_canary_${runtimeRole.slice(4)}`,`t06_canary_${runtimeRole.slice(4)}_id_seq`]])).rows[0];
    if(!row||row.connect!==true||row.create_db!==false||row.temp!==false
      ||row.create_public!==false||row.business_usage!==true||row.business_create!==false
      ||row.metadata_update!==false||row.configuration_update!==false||row.audit_insert!==false
      ||row.business_owner!==migrationRole||row.business_objects!==0)
      throw new Error('AGENCY_RUNTIME_ACL_DIVERGED');
    const defaults=(await client.query(`SELECT n.nspname,d.defaclobjtype,a.privilege_type
      FROM pg_default_acl d JOIN pg_namespace n ON n.oid=d.defaclnamespace,
        LATERAL aclexplode(d.defaclacl) a
      WHERE d.defaclrole=$1::regrole AND a.grantee=$2::regrole`,[migrationRole,runtimeRole])).rows;
    const actual=defaults.map(r=>`${r.nspname}:${r.defaclobjtype}:${r.privilege_type}`).sort();
    const expected=['business:r:SELECT','business:r:INSERT','business:r:UPDATE','business:r:DELETE',
      'business:S:USAGE','business:S:SELECT'].sort();
    if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error('AGENCY_DEFAULT_ACL_DIVERGED');
  }
  async projectAudit(client:PoolClient,event:{eventId:string;eventType:string;version:bigint;correlation:string},afterInsert?:()=>Promise<void>):Promise<void> {
    await client.query('INSERT INTO audit_event(event_id,event_type,resource_version,correlation) VALUES($1,$2,$3,$4) ON CONFLICT(event_id) DO NOTHING',[event.eventId,event.eventType,event.version.toString(),event.correlation]);
    await afterInsert?.();
    const row=(await client.query('SELECT event_type,resource_version::text,correlation FROM audit_event WHERE event_id=$1',[event.eventId])).rows[0];
    if(!row||row.event_type!==event.eventType||row.resource_version!==event.version.toString()||row.correlation!==event.correlation)throw new Error('AUDIT_PROJECTION_CONFLICT');
  }
}
