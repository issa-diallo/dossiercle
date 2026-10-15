import type { PoolClient } from 'pg';

const tables = ['control.agency_invitation', 'control.agency', 'identity.membership',
  'control.provisioning_operation', 'control.idempotency_record'] as const;
const inserts: Record<string, readonly string[]> = {
  'control.agency_invitation': ['id', 'root_id', 'subject_id', 'contact', 'owner_id', 'recovery_channel_ref'],
  'control.agency': ['id', 'invitation_root_id', 'name', 'canonical_name_hash'],
  'identity.membership': ['subject_id', 'agency_id', 'role'],
  'control.provisioning_operation': ['id', 'agency_id'],
};
const invitationUpdates = ['token_hash', 'expires_at', 'status', 'version'];

/** Bootstrap owns role creation; the schema owner alone applies object grants. */
export async function grantT05Capabilities(client: PoolClient): Promise<void> {
  await assertT05Role(client);
  await client.query('GRANT USAGE ON SCHEMA control,identity TO control_t05');
  await client.query(`GRANT SELECT ON ${tables.join(',')} TO control_t05`);
  for (const [table, columns] of Object.entries(inserts)) {
    await client.query(`GRANT INSERT(${columns.join(',')}) ON ${table} TO control_t05`);
  }
  await client.query('GRANT INSERT ON control.idempotency_record TO control_t05');
  await client.query(`GRANT UPDATE(${invitationUpdates.join(',')}) ON control.agency_invitation TO control_t05`);
  await assertT05Capabilities(client);
}

/** Assert exact role/membership configuration, including unexpected inbound/outbound grants. */
export async function assertT05Role(client: PoolClient): Promise<void> {
  const role = (await client.query(`SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,
    rolinherit,rolreplication,rolbypassrls FROM pg_roles WHERE rolname='control_t05'`)).rows;
  if (role.length !== 1 || Object.values(role[0]!).some(value => value !== false)) {
    throw new Error('T05_ROLE_DIVERGED');
  }
  const membership = (await client.query(`SELECT r.rolname AS role,m.rolname AS member,
    a.admin_option,a.inherit_option,a.set_option FROM pg_auth_members a
    JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member
    WHERE r.rolname='control_t05' OR m.rolname='control_t05'`)).rows;
  if (membership.length !== 1 || membership[0]!.role !== 'control_t05'
      || membership[0]!.member !== 'control_coordinator' || membership[0]!.admin_option !== false
      || membership[0]!.inherit_option !== false || membership[0]!.set_option !== true) {
    throw new Error('T05_MEMBERSHIP_DIVERGED');
  }
  const ownership = (await client.query(`SELECT
    EXISTS(SELECT 1 FROM pg_class WHERE relowner='control_t05'::regrole)
    OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspowner='control_t05'::regrole)
    OR EXISTS(SELECT 1 FROM pg_proc WHERE proowner='control_t05'::regrole)
    OR EXISTS(SELECT 1 FROM pg_database WHERE datdba='control_t05'::regrole) AS owns`)).rows[0];
  if (ownership?.owns !== false) throw new Error('T05_OWNER_REFUSED');
}

/** Detect drift rather than silently revoking and masking an unexpected capability. */
export async function assertT05Capabilities(client: PoolClient): Promise<void> {
  await assertT05Role(client);
  const actual: string[] = [];
  const expected: string[] = ['schema:control:USAGE', 'schema:identity:USAGE'];
  for (const table of tables) expected.push(`table:${table}:SELECT`);
  expected.push('table:control.idempotency_record:INSERT');
  for (const [table, columns] of Object.entries(inserts)) {
    for (const column of columns) expected.push(`column:${table}.${column}:INSERT`);
  }
  for (const column of invitationUpdates) expected.push(`column:control.agency_invitation.${column}:UPDATE`);
  const schemas = await client.query(`SELECT nspname,a.privilege_type,a.is_grantable FROM pg_namespace n,
    LATERAL aclexplode(n.nspacl) a WHERE a.grantee='control_t05'::regrole`);
  for (const row of schemas.rows) {
    if (row.is_grantable) throw new Error('T05_GRANT_OPTION_REFUSED');
    actual.push(`schema:${row.nspname}:${row.privilege_type}`);
  }
  const relations = await client.query(`SELECT n.nspname,c.relname,a.privilege_type,a.is_grantable
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace,
    LATERAL aclexplode(c.relacl) a WHERE a.grantee='control_t05'::regrole`);
  for (const row of relations.rows) {
    if (row.is_grantable) throw new Error('T05_GRANT_OPTION_REFUSED');
    actual.push(`table:${row.nspname}.${row.relname}:${row.privilege_type}`);
  }
  const columns = await client.query(`SELECT n.nspname,c.relname,t.attname,a.privilege_type,a.is_grantable
    FROM pg_attribute t JOIN pg_class c ON c.oid=t.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace,
    LATERAL aclexplode(t.attacl) a WHERE a.grantee='control_t05'::regrole`);
  for (const row of columns.rows) {
    if (row.is_grantable) throw new Error('T05_GRANT_OPTION_REFUSED');
    actual.push(`column:${row.nspname}.${row.relname}.${row.attname}:${row.privilege_type}`);
  }
  const routines = await client.query(`SELECT count(*)::int AS n FROM pg_proc p,
    LATERAL aclexplode(p.proacl) a WHERE a.grantee='control_t05'::regrole`);
  if (routines.rows[0]?.n !== 0 || JSON.stringify(actual.sort()) !== JSON.stringify(expected.sort())) {
    throw new Error('T05_OBJECT_ACL_DIVERGED');
  }
}
