import type { PoolClient } from 'pg';
/** The provisioner may SET ROLE to this non-login role for central state transitions. */
export async function grantT06Capabilities(client: PoolClient): Promise<void> {
    await assertT06Role(client);
    await client.query('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA control,identity FROM control_t06');
    await client.query('REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA control,identity FROM control_t06');
    await client.query('REVOKE ALL PRIVILEGES ON SCHEMA control,identity FROM control_t06');
    await client.query('GRANT USAGE ON SCHEMA s01_migration TO control_api,control_coordinator,control_dispatcher,provisioner');
    await client.query('GRANT SELECT ON s01_migration.version TO control_api,control_coordinator,control_dispatcher,provisioner');
    await client.query('GRANT USAGE ON SCHEMA control,identity TO control_t06');
    await client.query(`GRANT SELECT ON control.agency_invitation,control.agency,control.provisioning_operation,
    control.database_locator,control.audit_event,control.provisioning_effect,control.provisioning_execution,
    control.provisioning_gate,control.provisioning_wakeup,control.outbox,identity.account_authority,identity.membership TO control_t06`);
    await client.query('GRANT INSERT ON control.database_locator,control.provisioning_effect,control.provisioning_execution TO control_t06');
    await client.query('GRANT UPDATE(state,ready_schema_version,version) ON control.agency TO control_t06');
    await client.query('GRANT UPDATE(step,status,last_error_code,retryable,attempt,version,wakeup_generation) ON control.provisioning_operation TO control_t06');
    await client.query('GRANT UPDATE(schema_version,verification_version) ON control.database_locator TO control_t06');
    await client.query('GRANT UPDATE(status,evidence,updated_at) ON control.provisioning_effect TO control_t06');
    await client.query('GRANT UPDATE(state,closed_at,backends,fencing_evidence_ref) ON control.provisioning_execution TO control_t06');
    await client.query('GRANT SELECT,UPDATE(execution_id,state,version,updated_at) ON control.provisioning_gate TO control_t06');
    await client.query('REVOKE EXECUTE ON FUNCTION control.lock_provisioning_scope(uuid) FROM provisioner');
    await client.query('GRANT EXECUTE ON FUNCTION control.lock_provisioning_scope(uuid) TO control_t06');
    await assertT06Capabilities(client);
}
export async function assertT06Role(client: PoolClient): Promise<void> {
    const rows = (await client.query(`SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit,
    rolreplication,rolbypassrls FROM pg_roles WHERE rolname='control_t06'`)).rows;
    if (rows.length !== 1 || Object.values(rows[0]!).some(value => value !== false))
        throw new Error('T06_ROLE_DIVERGED');
    const members = (await client.query(`SELECT r.rolname AS role,m.rolname AS member,a.admin_option,a.inherit_option,a.set_option
    FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member
    WHERE r.rolname='control_t06' OR m.rolname='control_t06'`)).rows;
    if (members.length !== 1 || members[0]!.role !== 'control_t06' || members[0]!.member !== 'provisioner'
        || members[0]!.admin_option !== false || members[0]!.inherit_option !== false || members[0]!.set_option !== true) {
        throw new Error('T06_MEMBERSHIP_DIVERGED');
    }
    const ownership = (await client.query(`SELECT EXISTS(SELECT 1 FROM pg_class WHERE relowner='control_t06'::regrole)
    OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspowner='control_t06'::regrole)
    OR EXISTS(SELECT 1 FROM pg_proc WHERE proowner='control_t06'::regrole)
    OR EXISTS(SELECT 1 FROM pg_database WHERE datdba='control_t06'::regrole) AS owns`)).rows[0];
    if (ownership?.owns !== false)
        throw new Error('T06_OWNER_REFUSED');
}
export async function assertT06Capabilities(client: PoolClient): Promise<void> {
    await assertT06Role(client);
    const schemas = (await client.query(`SELECT n.nspname,a.privilege_type,a.is_grantable FROM pg_namespace n,LATERAL aclexplode(n.nspacl) a WHERE a.grantee='control_t06'::regrole`)).rows;
    const expectedSchema = ['control:USAGE', 'identity:USAGE'];
    const actualSchema = schemas.map(r => {
        if (r.is_grantable)
            throw new Error('T06_GRANT_OPTION_REFUSED');
        return `${r.nspname}:${r.privilege_type}`;
    }).sort();
    const rels = (await client.query(`SELECT n.nspname,c.relname,a.privilege_type,a.is_grantable FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace,LATERAL aclexplode(c.relacl) a WHERE a.grantee='control_t06'::regrole`)).rows;
    const expectedRel: string[] = [];
    for (const name of ['agency_invitation', 'agency', 'provisioning_operation', 'database_locator', 'audit_event', 'provisioning_effect', 'provisioning_execution', 'provisioning_gate', 'provisioning_wakeup', 'outbox', 'account_authority', 'membership'])
        expectedRel.push(`${name === 'account_authority' || name === 'membership' ? 'identity' : 'control'}.${name}:SELECT`);
    for (const name of ['database_locator', 'provisioning_effect', 'provisioning_execution'])
        expectedRel.push(`control.${name}:INSERT`);
    const actualRel = rels.map(r => {
        if (r.is_grantable)
            throw new Error('T06_GRANT_OPTION_REFUSED');
        return `${r.nspname}.${r.relname}:${r.privilege_type}`;
    }).sort();
    const columns = (await client.query(`SELECT n.nspname,c.relname,t.attname,a.privilege_type,a.is_grantable FROM pg_attribute t JOIN pg_class c ON c.oid=t.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace,LATERAL aclexplode(t.attacl) a WHERE a.grantee='control_t06'::regrole`)).rows;
    const expectedCols = ['agency.state:UPDATE', 'agency.ready_schema_version:UPDATE', 'agency.version:UPDATE',
        ...['step', 'status', 'last_error_code', 'retryable', 'attempt', 'version', 'wakeup_generation'].map(c => `provisioning_operation.${c}:UPDATE`),
        ...['schema_version', 'verification_version'].map(c => `database_locator.${c}:UPDATE`),
        ...['status', 'evidence', 'updated_at'].map(c => `provisioning_effect.${c}:UPDATE`),
        ...['state', 'closed_at', 'backends', 'fencing_evidence_ref'].map(c => `provisioning_execution.${c}:UPDATE`),
        ...['execution_id', 'state', 'version', 'updated_at'].map(c => `provisioning_gate.${c}:UPDATE`)];
    const actualCols = columns.map(r => {
        if (r.is_grantable)
            throw new Error('T06_GRANT_OPTION_REFUSED');
        return `${r.relname}.${r.attname}:${r.privilege_type}`;
    }).sort();
    const routines = (await client.query(`SELECT n.nspname,p.proname,a.privilege_type,a.is_grantable FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace,LATERAL aclexplode(p.proacl) a WHERE a.grantee='control_t06'::regrole`)).rows;
    const actualRoutines = routines.map(r => {
        if (r.is_grantable)
            throw new Error('T06_GRANT_OPTION_REFUSED');
        return `${r.nspname}.${r.proname}:${r.privilege_type}`;
    }).sort();
    if (JSON.stringify(actualSchema) !== JSON.stringify(expectedSchema) || JSON.stringify(actualRel.sort()) !== JSON.stringify(expectedRel.sort()) || JSON.stringify(actualCols.sort()) !== JSON.stringify(expectedCols.sort()) || JSON.stringify(actualRoutines) !== JSON.stringify(['control.lock_provisioning_scope:EXECUTE']))
        throw new Error('T06_OBJECT_ACL_DIVERGED');
}
