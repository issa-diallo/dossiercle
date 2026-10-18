import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { PoolClient } from 'pg';
import { grantT05Capabilities } from './t05-capabilities.js';
import { grantT06Capabilities } from './t06-capabilities.js';
import { grantT07Capabilities } from './t07-capabilities.js';
export type SchemaKind = 'control' | 'agency';
/** One database, one transaction, advisory lock retained through ownership checks. */
export async function migrate(client: PoolClient, kind: SchemaKind, agencyId?: string): Promise<string> {
  if (kind === 'agency' && !agencyId) throw new Error('MIGRATION_OWNER_REQUIRED');
  const source = await readFile(new URL(`../../migrations/${kind}/0001_s01.sql`, import.meta.url), 'utf8');
  const correction=kind==='control'?await readFile(new URL('../../migrations/control/0002_s01_runtime_capabilities.sql',import.meta.url),'utf8'):'';
  const scopeCorrection=kind==='control'?await readFile(new URL('../../migrations/control/0003_s01_session_scope.sql',import.meta.url),'utf8'):'';
  const provisioningCorrection=kind==='control'?await readFile(new URL('../../migrations/control/0004_s01_provisioning.sql',import.meta.url),'utf8'):'';
  const wakeupCorrection=kind==='control'?await readFile(new URL('../../migrations/control/0005_s01_provisioning_wakeup.sql',import.meta.url),'utf8'):'';
  const priorChecksum=createHash('sha256').update(correction?source+'\n'+correction:source).digest('hex');
  const baseChecksum=createHash('sha256').update(source).digest('hex');
  const legacyChecksum = createHash('sha256').update(scopeCorrection?source+'\n'+correction+'\n'+scopeCorrection:source).digest('hex');
  const provisioningChecksum = createHash('sha256').update(provisioningCorrection?source+'\n'+correction+'\n'+scopeCorrection+'\n'+provisioningCorrection:source).digest('hex');
  const checksum=createHash('sha256').update(wakeupCorrection?source+'\n'+correction+'\n'+scopeCorrection+'\n'+provisioningCorrection+'\n'+wakeupCorrection:source).digest('hex');
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('s01.schema',0))");
    await client.query('CREATE SCHEMA IF NOT EXISTS s01_migration');
    await client.query('REVOKE ALL ON SCHEMA s01_migration FROM PUBLIC');
    await client.query('CREATE TABLE IF NOT EXISTS s01_migration.version (singleton boolean PRIMARY KEY CHECK(singleton), version integer NOT NULL CHECK(version=1), kind text NOT NULL, checksum text NOT NULL, owner_id uuid, schema_fingerprint text NOT NULL)');
    const previous = await client.query<{ version: number; kind: string; checksum: string; owner_id: string | null; schema_fingerprint: string }>('SELECT * FROM s01_migration.version');
    if (previous.rows.length) {
      const row = previous.rows[0]!;
      const accepted=[checksum,provisioningChecksum,legacyChecksum,...(correction?[baseChecksum,priorChecksum]:[])];
      if (row.version !== 1 || row.kind !== kind || !accepted.includes(row.checksum) || row.owner_id !== (agencyId ?? null)) throw new Error('MIGRATION_STATE_DIVERGED');
      await assertStoredFingerprint(client,kind,row.schema_fingerprint);
      if (row.checksum!==checksum) {
        if(row.checksum===baseChecksum)await client.query(correction);
        if(row.checksum===baseChecksum||row.checksum===priorChecksum)await client.query(scopeCorrection);
        if(provisioningCorrection&&row.checksum!==provisioningChecksum)await client.query(provisioningCorrection);
        if(wakeupCorrection)await client.query(wakeupCorrection);
        await client.query('UPDATE s01_migration.version SET checksum=$1,schema_fingerprint=$2 WHERE singleton=true',[checksum,await fingerprint(client,kind)]);
      }
      if (kind === 'agency') {
        const marker = await client.query('SELECT agency_id, schema_version, migration_checksum FROM public.agency_metadata WHERE singleton=true');
        if (marker.rows.length !== 1 || marker.rows[0].agency_id !== agencyId || marker.rows[0].schema_version !== 1 || marker.rows[0].migration_checksum !== checksum) throw new Error('MIGRATION_OWNER_DIVERGED');
      }
    } else {
      await client.query(source);
      if(correction)await client.query(correction);
      if(scopeCorrection)await client.query(scopeCorrection);
      if(provisioningCorrection)await client.query(provisioningCorrection);
      if(wakeupCorrection)await client.query(wakeupCorrection);
      if (kind === 'agency') {
        await client.query('INSERT INTO public.agency_metadata(singleton,agency_id,schema_version,migration_checksum) VALUES(true,$1,1,$2)', [agencyId,checksum]);
        await client.query('INSERT INTO public.agency_configuration(singleton) VALUES(true)');
      }
      await client.query('INSERT INTO s01_migration.version VALUES(true,1,$1,$2,$3,$4)', [kind,checksum,agencyId ?? null,await fingerprint(client,kind)]);
    }
    await assertSchema(client,kind);
    await client.query('COMMIT');
    return checksum;
  } catch {
    await client.query('ROLLBACK');
    throw new Error('MIGRATION_CLOSED');
  }
}

async function fingerprint(client: PoolClient, kind: SchemaKind): Promise<string> {
  const result = await client.query(`SELECT n.nspname,c.relname,a.attname,a.atttypid::regtype::text AS type,a.attnotnull,pg_get_expr(d.adbin,d.adrelid) AS default_value,
    (SELECT jsonb_agg(pg_get_constraintdef(k.oid) ORDER BY k.conname) FROM pg_constraint k WHERE k.conrelid=c.oid) AS constraints
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE n.nspname=ANY($1::text[]) AND c.relkind='r' ORDER BY n.nspname,c.relname,a.attnum`,[kind==='control'?['control','identity']:['public']]);
  const routines=await client.query(`SELECT n.nspname,p.proname,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=ANY($1::text[]) ORDER BY n.nspname,p.proname,p.oid::regprocedure::text`,[kind==='control'?['control','identity']:['public']]);
  return createHash('sha256').update(JSON.stringify(result.rows)+(routines.rows.length?JSON.stringify(routines.rows):'')).digest('hex');
}

async function assertStoredFingerprint(client: PoolClient, kind: SchemaKind, expected: string): Promise<void> {
  if (expected !== await fingerprint(client,kind)) throw new Error('MIGRATION_SCHEMA_DIVERGED');
}

export async function assertSchema(client: PoolClient, kind: SchemaKind): Promise<void> {
  const result=await client.query<{schema_fingerprint:string}>('SELECT schema_fingerprint FROM s01_migration.version WHERE singleton=true');
  if (result.rows.length!==1 || result.rows[0]!.schema_fingerprint!==await fingerprint(client,kind)) throw new Error('MIGRATION_SCHEMA_DIVERGED');
  const publicRights=await client.query(`SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace,
    LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
    WHERE n.nspname=ANY($1::text[]) AND c.relkind='r' AND a.grantee=0`,[kind==='control'?['control','identity']:['public']]);
  const schemaRights=await client.query(`SELECT count(*)::int AS n FROM pg_namespace n,
    LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
    WHERE n.nspname=ANY($1::text[]) AND a.grantee=0`,[kind==='control'?['control','identity']:['public']]);
  const functionRights=await client.query(`SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE n.nspname=ANY($1::text[]) AND a.grantee=0`,[kind==='control'?['control','identity']:['public']]);
  if (functionRights.rows[0].n!==0 || publicRights.rows[0].n!==0 || schemaRights.rows[0].n!==0) throw new Error('MIGRATION_PUBLIC_RIGHTS');
}

export async function assertControlProvisioningSchema(client:PoolClient):Promise<void>{
  const paths=['0001_s01.sql','0002_s01_runtime_capabilities.sql','0003_s01_session_scope.sql','0004_s01_provisioning.sql','0005_s01_provisioning_wakeup.sql'];
  const sources=await Promise.all(paths.map(name=>readFile(new URL(`../../migrations/control/${name}`,import.meta.url),'utf8')));
  const checksum=createHash('sha256').update(sources.join('\n')).digest('hex');
  const row=(await client.query<{checksum:string}>('SELECT checksum FROM s01_migration.version WHERE singleton=true AND kind=$1 AND version=1',['control'])).rows[0];
  if(!row||row.checksum!==checksum)throw new Error('CONTROL_SCHEMA_VERSION_CLOSED');
  await assertSchema(client,'control');
}

/** Explicit principals; granting audit mutations or DDL to runtime is forbidden. */
export async function grantControlCapabilities(client: PoolClient, runtime: string, auditWriter: string): Promise<void> {
  const valid = /^[a-z][a-z0-9_]{0,62}$/;
  if (!valid.test(runtime) || !valid.test(auditWriter) || runtime===auditWriter) throw new Error('INVALID_CAPABILITY_ROLE');
  const quote = (role: string) => `"${role}"`;
  await client.query(`GRANT USAGE ON SCHEMA control,identity TO ${quote(runtime)},${quote(auditWriter)}`);
  await client.query(`GRANT EXECUTE ON FUNCTION control.lock_authority(uuid,boolean) TO ${quote(runtime)}`);
  await client.query(`GRANT SELECT ON ALL TABLES IN SCHEMA control,identity TO ${quote(runtime)}`);
  await client.query(`GRANT INSERT,UPDATE ON control.agency_invitation,control.agency,control.provisioning_operation,control.idempotency_record,identity.membership,identity.session TO ${quote(runtime)}`);
  await client.query(`GRANT SELECT,INSERT ON control.audit_event,control.outbox TO ${quote(auditWriter)}`);
}

// Local migration entrypoint. Bootstrap capabilities are deliberately absent.
if (process.argv[1] && (await import('node:url')).pathToFileURL(process.argv[1]).href === import.meta.url) {
  if (process.argv.length!==3 || process.argv[2]!=='--synthetic-control') throw new Error('SYNTHETIC_CONTROL_ONLY');
  const { Pool }=await import('pg');
  const environment=JSON.parse(await readFile('.local/environment.json','utf8')) as {syntheticOnly:boolean; private:string; pgPort:number};
  if (!environment.syntheticOnly) throw new Error('SYNTHETIC_REQUIRED');
  const pool=new Pool({host:'127.0.0.1',port:environment.pgPort,database:'control',user:'control_migrator',password:(await readFile(`${environment.private}/pg/control_migrator`,'utf8')).trim(),max:1});
  const client=await pool.connect();
  try {
    const checksum=await migrate(client,'control');
    await client.query('BEGIN');
    await grantControlCapabilities(client,'control_api','control_audit');
    await grantCoordinatorCapabilities(client);
    await grantDispatcherCapabilities(client);
    await grantT05Capabilities(client);
      await grantT06Capabilities(client);
      await grantT07Capabilities(client);
    await client.query('COMMIT');
    console.log(JSON.stringify({schemaVersion:1,checksum}));
  } catch { await client.query('ROLLBACK'); process.exitCode=1; console.error('MIGRATION_CLOSED'); }
  finally {client.release();await pool.end();}
}

export async function grantCoordinatorCapabilities(client:PoolClient):Promise<void> {
  await client.query('GRANT USAGE ON SCHEMA control,identity TO control_coordinator');
  await client.query('GRANT SELECT ON ALL TABLES IN SCHEMA control,identity TO control_coordinator');
  await client.query('GRANT EXECUTE ON FUNCTION control.lock_authority(uuid,boolean),control.lock_session_scope(uuid,uuid) TO control_coordinator');
  await client.query('GRANT INSERT,UPDATE ON identity.account_authority,identity.membership,identity.session TO control_coordinator');
  await client.query('GRANT INSERT ON control.idempotency_record TO control_coordinator');
  await client.query('GRANT UPDATE(identity_status) ON control.agency_invitation TO control_coordinator');
}

export async function grantDispatcherCapabilities(client:PoolClient,role='control_dispatcher'):Promise<void> {
  if(!/^[a-z][a-z0-9_]{0,62}$/.test(role))throw new Error('INVALID_DISPATCHER_ROLE');
  await client.query(`GRANT USAGE ON SCHEMA control TO "${role}"`);
  await client.query(`GRANT SELECT,UPDATE(status,attempt) ON control.outbox TO "${role}"`);
  await client.query(`GRANT SELECT(event_id,event_type,agency_id,resource_id,correlation,resource_version,schema_version) ON control.audit_event TO "${role}"`);
  await client.query(`GRANT SELECT(id,state,version,activated_at) ON control.agency TO "${role}"`);
  await client.query(`GRANT SELECT(id,agency_id,status,step) ON control.provisioning_operation TO "${role}"`);
  await client.query(`GRANT SELECT ON control.provisioning_wakeup TO "${role}"`);
}
