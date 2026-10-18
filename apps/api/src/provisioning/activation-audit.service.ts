import { createHash } from 'node:crypto';
import { Pool, type PoolClient } from '@dossiercle/adapters/postgres/runtime-pool';
import { AgencyRepository } from '@dossiercle/adapters/postgres/agency.repository';
import { FileSecretStore } from '@dossiercle/adapters/secrets/secret-store';
import { ActivationEventData, parseActivationEvent, ACTIVATION_EVENT } from '@dossiercle/contracts/activation-events';
import { parseActivationReservation } from './activation-audit.validation.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export interface ActivationAuditConfiguration {pool:Pool;secrets:FileSecretStore;host:string;port:number}

/** The private provisioner reloads all authority and locator values from the central reservation. */
export class ActivationAuditService {
  constructor(private readonly config:ActivationAuditConfiguration){}

  async prepare(reservationId:string,eventId:string):Promise<void>{
    const source=await this.reservation(reservationId,eventId);
    if(source.state!=='READY')throw new Error('ACTIVATION_SOURCE_CLOSED');
    await this.withLocal(source,async client=>{
      await new AgencyRepository().projectAudit(client,{eventId,eventType:'agency.activation.prepared.v1',
        version:BigInt(source.targetVersion),correlation:source.operationId});
    });
  }

  async read(reservationId:string,eventId:string){
    const source=await this.reservation(reservationId,eventId);
    const tuple=await this.withLocal(source,async client=>{
      const row=(await client.query('SELECT event_id,event_type,resource_version::text AS version,correlation FROM audit_event WHERE event_id=$1',[eventId])).rows[0];
      if(!row||row.event_type!=='agency.activation.prepared.v1'||row.version!==source.targetVersion||row.correlation!==source.operationId)
        throw new Error('ACTIVATION_PREPARED_AUDIT_DIVERGED');
      return {eventId:row.event_id as string,eventType:row.event_type as string,version:row.version as string,correlation:row.correlation as string};
    });
    return tuple;
  }

  async project(eventId:string):Promise<void>{
    if(!uuid.test(eventId))throw new Error('ACTIVATION_EVENT_REFUSED');
    const source=await this.readActivatedSource(eventId);
    const data=ActivationEventData.parse({schemaVersion:1,agencyId:source.agencyId,resourceId:source.agencyId,version:source.version});
    parseActivationEvent(ACTIVATION_EVENT,data);
    const locator=await this.locator(source.agencyId);
    await this.withLocal({...source,...locator},async client=>{
      await new AgencyRepository().projectAudit(client,{eventId,eventType:ACTIVATION_EVENT,version:BigInt(source.version),correlation:source.correlation});
      const readback=(await client.query('SELECT event_type,resource_version::text AS version,correlation FROM audit_event WHERE event_id=$1',[eventId])).rows[0];
      if(!readback||readback.event_type!==ACTIVATION_EVENT||readback.version!==source.version||readback.correlation!==source.correlation)
        throw new Error('ACTIVATION_PROJECTION_DIVERGED');
    });
  }

  private async reservation(reservationId:string,eventId:string){
    if(!uuid.test(reservationId)||!uuid.test(eventId))throw new Error('ACTIVATION_RESERVATION_REFUSED');
    const c=await this.config.pool.connect();
    try{
      await c.query('BEGIN');await c.query('SET LOCAL ROLE control_t07_local_reader');
      const row=(await c.query(`SELECT actor_id,operation_type,key,canonical_body_hash,resource_id,result
        FROM control.idempotency_record WHERE key=$1`,[reservationId])).rows[0];
      const parsed=parseActivationReservation(row?.result);
      if(!row||!row.operation_type.startsWith(`t07.activation-prepare.v1:${row.resource_id}:`)
        ||row.key!==reservationId||parsed.reservationId!==reservationId||parsed.prepared.eventId!==eventId
        ||row.canonical_body_hash!==parsed.bindingHash)throw new Error('ACTIVATION_RESERVATION_REFUSED');
      const source=(await c.query(`SELECT a.id AS agency_id,a.state,a.ready_schema_version,a.invitation_root_id,i.subject_id,o.id AS operation_id,o.step,o.status,
        l.database_name,l.runtime_role,l.migration_role,l.migration_secret_ref,l.secret_ref,l.secret_version,l.schema_version,
        l.verification_version::text,l.ownership_tag
        FROM control.agency a JOIN control.agency_invitation i ON i.root_id=a.invitation_root_id
        JOIN control.provisioning_operation o ON o.agency_id=a.id
        JOIN control.database_locator l ON l.agency_id=a.id WHERE a.id=$1`,[row.resource_id])).rows[0];
      const expected=hashBinding(source);
      if(!source||source.subject_id!==row.actor_id||source.operation_id!==parsed.operationId||source.agency_id!==row.resource_id
        ||expected!==parsed.bindingHash||source.ready_schema_version!==1||source.schema_version!==1||String(source.verification_version)!==String(source.secret_version)
        ||source.database_name!==`ag_${String(source.agency_id).replaceAll('-','')}`
        ||source.migration_role!==`agm_${String(source.agency_id).replaceAll('-','')}`
        ||source.state!=='READY'||source.status!=='SUCCEEDED'||source.step!=='READY'
        ||(source.state!=='READY'&&source.state!=='ACTIVE'))throw new Error('ACTIVATION_BINDING_DIVERGED');
      await c.query('COMMIT');
      return {agencyId:source.agency_id as string,operationId:source.operation_id as string,targetVersion:parsed.targetVersion,
        state:source.state as string,databaseName:source.database_name as string,runtimeRole:source.runtime_role as string,migrationRole:source.migration_role as string,
        migrationSecretRef:source.migration_secret_ref as string,secretRef:source.secret_ref as string,secretVersion:source.secret_version as number};
    }catch(error){await c.query('ROLLBACK').catch(()=>{});throw error;}finally{c.release();}
  }

  private async locator(agencyId:string){
    const c=await this.config.pool.connect();
    try{await c.query('BEGIN');await c.query('SET LOCAL ROLE control_t07_local_reader');
      const row=(await c.query(`SELECT a.state,a.version::text,o.id AS operation_id,l.database_name,l.runtime_role,l.migration_role,l.migration_secret_ref,
        l.secret_ref,l.secret_version,l.schema_version,l.verification_version::text,l.ownership_tag
        FROM control.agency a JOIN control.agency_invitation i ON i.root_id=a.invitation_root_id
        JOIN control.provisioning_operation o ON o.agency_id=a.id
        JOIN control.database_locator l ON l.agency_id=a.id WHERE a.id=$1`,[agencyId])).rows[0];
      if(!row||row.state!=='ACTIVE'||row.schema_version!==1||String(row.verification_version)!==String(row.secret_version))throw new Error('ACTIVATION_BINDING_DIVERGED');
      await c.query('COMMIT');return {agencyId,operationId:row.operation_id as string,targetVersion:String(row.version),state:row.state as string,
        databaseName:row.database_name as string,runtimeRole:row.runtime_role as string,migrationRole:row.migration_role as string,migrationSecretRef:row.migration_secret_ref as string,
        secretRef:row.secret_ref as string,secretVersion:row.secret_version as number};
    }catch(error){await c.query('ROLLBACK').catch(()=>{});throw error;}finally{c.release();}
  }

  private async readActivatedSource(eventId:string){
    const c=await this.config.pool.connect();
    try{await c.query('BEGIN');await c.query('SET LOCAL ROLE control_t07_local_reader');
      const row=(await c.query(`SELECT a.agency_id,a.event_type,a.resource_version::text AS version,a.correlation,a.resource_id
        FROM control.audit_event a JOIN control.outbox o USING(event_id)
        JOIN control.agency g ON g.id=a.agency_id JOIN control.provisioning_operation p ON p.agency_id=g.id
        WHERE a.event_id=$1 AND a.event_type='agency.activated.v1' AND o.type=a.event_type
          AND o.schema_version=1 AND a.schema_version=o.schema_version
          AND o.agency_id=a.agency_id AND o.resource_id=a.resource_id AND o.version=a.resource_version
          AND g.state='ACTIVE' AND g.activated_at IS NOT NULL AND g.version=a.resource_version
          AND a.resource_id=g.id AND a.correlation=p.id
          AND p.status='SUCCEEDED' AND p.step='ACTIVE'`,[eventId])).rows[0];
      if(!row)throw new Error('ACTIVATION_EVENT_SOURCE_REFUSED');await c.query('COMMIT');
      return {agencyId:row.agency_id as string,version:row.version as string,correlation:row.correlation as string};
    }catch(error){await c.query('ROLLBACK').catch(()=>{});throw error;}finally{c.release();}
  }

  private async withLocal<T>(source:{agencyId:string;operationId:string;databaseName:string;runtimeRole:string;migrationRole:string;
    migrationSecretRef:string;secretRef:string;secretVersion:number},work:(client:PoolClient)=>Promise<T>):Promise<T>{
    const password=await this.config.secrets.read({agencyId:source.agencyId,operationId:source.operationId,
      secretRef:source.migrationSecretRef,version:1,kind:'migration'});
    const pool=new Pool({host:this.config.host,port:this.config.port,database:source.databaseName,user:source.migrationRole,
      password:password.toString(),max:1,connectionTimeoutMillis:2000,statement_timeout:5000,query_timeout:5000});
    try{const client=await pool.connect();try{
      const actual=(await client.query(`SELECT current_database() AS database,current_user AS role,
        (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()) AS owner,
        (SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database()) AS tag`)).rows[0];
      if(actual?.database!==source.databaseName||actual.role!==source.migrationRole||actual.owner!==source.migrationRole||actual.tag!==`s01:t06:${source.agencyId}:${source.operationId}:database:v1`)throw new Error('ACTIVATION_LOCAL_CONNECTION_REFUSED');
      await new AgencyRepository().verify(client,source.agencyId);
      await new AgencyRepository().verifyRuntimeAcl(client,source.runtimeRole,source.migrationRole);
      return await work(client);
    }finally{client.release();}}finally{try{await pool.end();}finally{password.fill(0);}}
  }
}

const hashBinding=(source:Record<string,unknown>|undefined)=>source?createHash('sha256').update(JSON.stringify([
  source.agency_id,source.invitation_root_id,source.subject_id,source.operation_id,source.ready_schema_version,source.database_name,
  source.runtime_role,source.migration_role,source.migration_secret_ref,source.secret_ref,source.secret_version,source.schema_version,
  source.verification_version,source.ownership_tag])).digest('hex'):'';
