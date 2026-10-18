import type { PoolClient } from 'pg';

/** Coordinator-only, non-login role for the narrow central T07 transition. */
export async function grantT07Capabilities(client: PoolClient): Promise<void> {
  await assertT07Role(client);
  await assertT07ReaderRole(client);
  await client.query('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA control,identity FROM control_t07');
  await client.query('REVOKE ALL ON FUNCTION control.lock_session_scope(uuid,uuid) FROM control_t07');
  await client.query('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA control FROM control_t07_local_reader');
  await client.query('GRANT USAGE ON SCHEMA control,identity TO control_t07');
  await client.query(`GRANT SELECT(root_id,subject_id,status,identity_status,expires_at,version) ON control.agency_invitation TO control_t07`);
  await client.query(`GRANT SELECT(id,invitation_root_id,name,state,version,activated_at,ready_schema_version) ON control.agency TO control_t07`);
  await client.query(`GRANT SELECT(id,agency_id,step,status,version,attempt,retryable,last_error_code) ON control.provisioning_operation TO control_t07`);
  await client.query(`GRANT SELECT(agency_id,database_name,runtime_role,migration_role,secret_ref,migration_secret_ref,
    secret_version,schema_version,verification_version,ownership_tag) ON control.database_locator TO control_t07`);
  await client.query(`GRANT SELECT(effect_id,operation_id,kind,target_version,status) ON control.provisioning_effect TO control_t07`);
  await client.query(`GRANT SELECT(operation_id,state) ON control.provisioning_execution TO control_t07`);
  await client.query(`GRANT SELECT(singleton,state,execution_id) ON control.provisioning_gate TO control_t07`);
  await client.query(`GRANT SELECT(actor_id,operation_type,key,canonical_body_hash,resource_id,result) ON control.idempotency_record TO control_t07`);
  await client.query(`GRANT SELECT(subject_id,identity_epoch,confirmed_epoch,status,journal_sequence,journal_hash,enrollment_status,recovery_ready) ON identity.account_authority TO control_t07`);
  await client.query(`GRANT SELECT(subject_id,agency_id,role,state,version) ON identity.membership TO control_t07`);
  await client.query(`GRANT SELECT(cookie_hash,subject_id,scope,invitation_root_id,agency_id,epoch,issued_at,
    last_human_activity_at,absolute_expires_at,revoked_at,encrypted_oidc_tokens) ON identity.session TO control_t07`);
  await client.query('GRANT INSERT(actor_id,operation_type,key,canonical_body_hash,resource_id,result) ON control.idempotency_record TO control_t07');
  await client.query('GRANT UPDATE(state,version,activated_at) ON control.agency TO control_t07');
  await client.query('GRANT UPDATE(state,version) ON identity.membership TO control_t07');
  await client.query('GRANT UPDATE(step,status,last_error_code,retryable,version) ON control.provisioning_operation TO control_t07');
  await client.query('GRANT EXECUTE ON FUNCTION control.lock_authority(uuid,boolean) TO control_t07');
  await client.query('GRANT USAGE ON SCHEMA control TO control_t07_local_reader');
  await client.query(`GRANT SELECT(actor_id,operation_type,key,canonical_body_hash,resource_id,result) ON control.idempotency_record TO control_t07_local_reader`);
  await client.query(`GRANT SELECT(id,invitation_root_id,state,version,activated_at,ready_schema_version) ON control.agency TO control_t07_local_reader`);
  await client.query(`GRANT SELECT(root_id,subject_id) ON control.agency_invitation TO control_t07_local_reader`);
  await client.query(`GRANT SELECT(id,agency_id,step,status,version) ON control.provisioning_operation TO control_t07_local_reader`);
  await client.query(`GRANT SELECT(agency_id,database_name,runtime_role,migration_role,migration_secret_ref,secret_ref,secret_version,schema_version,verification_version,ownership_tag) ON control.database_locator TO control_t07_local_reader`);
  await client.query(`GRANT SELECT(operation_id,kind,target_version,status) ON control.provisioning_effect TO control_t07_local_reader`);
  await client.query(`GRANT SELECT(operation_id,state) ON control.provisioning_execution TO control_t07_local_reader`);
  await client.query(`GRANT SELECT(event_id,agency_id,actor_id,actor_type,event_type,resource_id,correlation,resource_version,schema_version) ON control.audit_event TO control_t07_local_reader`);
  await client.query(`GRANT SELECT(event_id,type,schema_version,agency_id,resource_id,version,status) ON control.outbox TO control_t07_local_reader`);
  await assertT07Capabilities(client);
}

async function assertT07ReaderRole(client: PoolClient): Promise<void> {
  const row=(await client.query(`SELECT r.rolcanlogin,r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolinherit,r.rolreplication,r.rolbypassrls,
    m.rolname AS member,a.admin_option,a.inherit_option,a.set_option,
    EXISTS(SELECT 1 FROM pg_class WHERE relowner=r.oid) OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspowner=r.oid)
      OR EXISTS(SELECT 1 FROM pg_proc WHERE proowner=r.oid) OR EXISTS(SELECT 1 FROM pg_database WHERE datdba=r.oid) AS owns
    FROM pg_roles r LEFT JOIN pg_auth_members a ON a.roleid=r.oid LEFT JOIN pg_roles m ON m.oid=a.member
    WHERE r.rolname='control_t07_local_reader'`)).rows;
  if(row.length!==1||Object.entries(row[0]!).some(([key,value])=>!['member','admin_option','inherit_option','set_option','owns'].includes(key)&&value!==false)
    ||row[0]!.member!=='provisioner'||row[0]!.admin_option!==false||row[0]!.inherit_option!==false||row[0]!.set_option!==true||row[0]!.owns!==false)
    throw new Error('T07_READER_ROLE_DIVERGED');
}

export async function assertT07Role(client: PoolClient): Promise<void> {
  const role = (await client.query(`SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit,
    rolreplication,rolbypassrls FROM pg_roles WHERE rolname='control_t07'`)).rows;
  const members = (await client.query(`SELECT r.rolname AS role,m.rolname AS member,a.admin_option,a.inherit_option,a.set_option
    FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member
    WHERE r.rolname='control_t07' OR m.rolname='control_t07'`)).rows;
  const owns = (await client.query(`SELECT EXISTS(SELECT 1 FROM pg_class WHERE relowner='control_t07'::regrole)
    OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspowner='control_t07'::regrole)
    OR EXISTS(SELECT 1 FROM pg_proc WHERE proowner='control_t07'::regrole)
    OR EXISTS(SELECT 1 FROM pg_database WHERE datdba='control_t07'::regrole) AS owns`)).rows[0]?.owns;
  if (role.length !== 1 || Object.values(role[0]!).some(value => value !== false)
      || members.length !== 1 || members[0]!.role !== 'control_t07' || members[0]!.member !== 'control_coordinator'
      || members[0]!.admin_option !== false || members[0]!.inherit_option !== false || members[0]!.set_option !== true
      || owns !== false) throw new Error('T07_ROLE_DIVERGED');
}

export async function assertT07Capabilities(client: PoolClient): Promise<void> {
  await assertT07Role(client);
  await assertT07ReaderCapabilities(client);
  const schemas = (await client.query(`SELECT n.nspname,a.privilege_type,a.is_grantable FROM pg_namespace n,
    LATERAL aclexplode(n.nspacl) a WHERE a.grantee='control_t07'::regrole`)).rows;
  const relations = (await client.query(`SELECT n.nspname,c.relname,a.privilege_type,a.is_grantable FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace,LATERAL aclexplode(c.relacl) a WHERE a.grantee='control_t07'::regrole`)).rows;
  const columns = (await client.query(`SELECT n.nspname,c.relname,t.attname,a.privilege_type,a.is_grantable FROM pg_attribute t
    JOIN pg_class c ON c.oid=t.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace,
    LATERAL aclexplode(t.attacl) a WHERE a.grantee='control_t07'::regrole`)).rows;
  const routines = (await client.query(`SELECT n.nspname,p.proname,a.privilege_type,a.is_grantable FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace,LATERAL aclexplode(p.proacl) a WHERE a.grantee='control_t07'::regrole`)).rows;
  const actualSchema = schemas.map(row => {
    if (row.is_grantable) throw new Error('T07_GRANT_OPTION_REFUSED');
    return `${row.nspname}:${row.privilege_type}`;
  }).sort();
  const actualRelations = relations.map(row => {
    if (row.is_grantable) throw new Error('T07_GRANT_OPTION_REFUSED');
    return `${row.nspname}.${row.relname}:${row.privilege_type}`;
  }).sort();
  const actualColumns = columns.map(row => {
    if (row.is_grantable) throw new Error('T07_GRANT_OPTION_REFUSED');
    return `${row.relname}.${row.attname}:${row.privilege_type}`;
  }).sort();
  const actualRoutines = routines.map(row => {
    if (row.is_grantable) throw new Error('T07_GRANT_OPTION_REFUSED');
    return `${row.nspname}.${row.proname}:${row.privilege_type}`;
  }).sort();
  const expectedRelations: string[] = [];
  const expectedColumns = ['agency.state:UPDATE','agency.version:UPDATE','agency.activated_at:UPDATE',
    'membership.state:UPDATE','membership.version:UPDATE',
    ...['step','status','last_error_code','retryable','version'].map(name => `provisioning_operation.${name}:UPDATE`),
    ...['root_id','subject_id','status','identity_status','expires_at','version'].map(v=>`agency_invitation.${v}:SELECT`),
    ...['id','invitation_root_id','name','state','version','activated_at','ready_schema_version'].map(v=>`agency.${v}:SELECT`),
    ...['id','agency_id','step','status','version','attempt','retryable','last_error_code'].map(v=>`provisioning_operation.${v}:SELECT`),
    ...['agency_id','database_name','runtime_role','migration_role','secret_ref','migration_secret_ref','secret_version','schema_version','verification_version','ownership_tag'].map(v=>`database_locator.${v}:SELECT`),
    ...['effect_id','operation_id','kind','target_version','status'].map(v=>`provisioning_effect.${v}:SELECT`),
    'provisioning_execution.operation_id:SELECT','provisioning_execution.state:SELECT',
    'provisioning_gate.singleton:SELECT','provisioning_gate.state:SELECT','provisioning_gate.execution_id:SELECT',
    ...['actor_id','operation_type','key','canonical_body_hash','resource_id','result'].map(v=>`idempotency_record.${v}:SELECT`),
    ...['subject_id','identity_epoch','confirmed_epoch','status','journal_sequence','journal_hash','enrollment_status','recovery_ready'].map(v=>`account_authority.${v}:SELECT`),
    ...['subject_id','agency_id','role','state','version'].map(v=>`membership.${v}:SELECT`),
    ...['cookie_hash','subject_id','scope','invitation_root_id','agency_id','epoch','issued_at','last_human_activity_at','absolute_expires_at','revoked_at','encrypted_oidc_tokens'].map(v=>`session.${v}:SELECT`)];
  expectedColumns.push(...['actor_id','operation_type','key','canonical_body_hash','resource_id','result'].map(v=>`idempotency_record.${v}:INSERT`));
  if (JSON.stringify(actualSchema) !== JSON.stringify(['control:USAGE','identity:USAGE'])
      || JSON.stringify(actualRelations) !== JSON.stringify(expectedRelations.sort())
      || JSON.stringify(actualColumns) !== JSON.stringify(expectedColumns.sort())
      || JSON.stringify(actualRoutines) !== JSON.stringify(['control.lock_authority:EXECUTE'].sort()))
    throw new Error('T07_OBJECT_ACL_DIVERGED');
}

async function assertT07ReaderCapabilities(client:PoolClient):Promise<void>{
  await assertT07ReaderRole(client);
  const schemas=(await client.query(`SELECT n.nspname,a.privilege_type,a.is_grantable FROM pg_namespace n,
    LATERAL aclexplode(n.nspacl) a WHERE a.grantee='control_t07_local_reader'::regrole`)).rows;
  const relations=(await client.query(`SELECT n.nspname,c.relname,a.privilege_type,a.is_grantable FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace,LATERAL aclexplode(c.relacl) a WHERE a.grantee='control_t07_local_reader'::regrole`)).rows;
  const columns=(await client.query(`SELECT n.nspname,c.relname,t.attname,a.privilege_type,a.is_grantable FROM pg_attribute t
    JOIN pg_class c ON c.oid=t.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace,
    LATERAL aclexplode(t.attacl) a WHERE a.grantee='control_t07_local_reader'::regrole`)).rows;
  const schema=schemas.map(r=>{if(r.is_grantable)throw new Error('T07_READER_GRANT_OPTION_REFUSED');return `${r.nspname}:${r.privilege_type}`;}).sort();
  const rel=relations.map(r=>{if(r.is_grantable)throw new Error('T07_READER_GRANT_OPTION_REFUSED');return `${r.nspname}.${r.relname}:${r.privilege_type}`;}).sort();
  const col=columns.map(r=>{if(r.is_grantable)throw new Error('T07_READER_GRANT_OPTION_REFUSED');return `${r.nspname}.${r.relname}.${r.attname}:${r.privilege_type}`;}).sort();
  const expected=[...['actor_id','operation_type','key','canonical_body_hash','resource_id','result'].map(v=>`control.idempotency_record.${v}:SELECT`),
    ...['id','invitation_root_id','state','version','activated_at','ready_schema_version'].map(v=>`control.agency.${v}:SELECT`),
    'control.agency_invitation.root_id:SELECT','control.agency_invitation.subject_id:SELECT',
    ...['id','agency_id','step','status','version'].map(v=>`control.provisioning_operation.${v}:SELECT`),
    ...['agency_id','database_name','runtime_role','migration_role','migration_secret_ref','secret_ref','secret_version','schema_version','verification_version','ownership_tag'].map(v=>`control.database_locator.${v}:SELECT`),
    ...['operation_id','kind','target_version','status'].map(v=>`control.provisioning_effect.${v}:SELECT`),
    'control.provisioning_execution.operation_id:SELECT','control.provisioning_execution.state:SELECT',
    ...['event_id','agency_id','actor_id','actor_type','event_type','resource_id','correlation','resource_version','schema_version'].map(v=>`control.audit_event.${v}:SELECT`),
    ...['event_id','type','schema_version','agency_id','resource_id','version','status'].map(v=>`control.outbox.${v}:SELECT`)].sort();
  if(JSON.stringify(schema)!==JSON.stringify(['control:USAGE'])||rel.length!==0||JSON.stringify(col)!==JSON.stringify(expected))
    throw new Error('T07_READER_OBJECT_ACL_DIVERGED');
}
