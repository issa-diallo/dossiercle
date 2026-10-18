import { createHash } from 'node:crypto';
import { FileSecretStore } from '../packages/adapters/dist/secrets/secret-store.js';
import { AgencyRepository } from '../packages/adapters/dist/postgres/agency.repository.js';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../packages/adapters/package.json', import.meta.url));
const { Pool } = require('pg');
const digest = value => createHash('sha256').update(value).digest('hex');
/** Readbacks only. An unavailable or ambiguous version never gets reconstructed. */
export async function inspectEffects({ central, admin, environment: e, execution: ex, allowClosedMigratedInspection = false }) {
    const effects = (await central.query('SELECT * FROM control.provisioning_effect WHERE operation_id=$1', [ex.operation_id])).rows;
    const locator = (await central.query('SELECT * FROM control.database_locator WHERE agency_id=$1', [ex.agency_id])).rows[0];
    const compact = ex.agency_id.replaceAll('-', '');
    const names = { database: `ag_${compact}`, runtimeRole: `agr_${compact}`, migrationRole: `agm_${compact}` };
    const roles = (await admin.query(`SELECT oid::text,rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,
  rolinherit,rolreplication,rolbypassrls,shobj_description(oid,'pg_authid') AS tag
  FROM pg_roles WHERE rolname=ANY($1::text[])`, [[names.runtimeRole, names.migrationRole]])).rows;
    const db = (await admin.query(`SELECT oid::text,datdba::regrole::text AS owner,datallowconn,
  shobj_description(oid,'pg_database') AS tag FROM pg_database WHERE datname=$1`, [names.database])).rows[0];
    if (!locator) {
        if (roles.length || db || effects.some(f => f.status !== 'PLANNED'))
            throw new Error('RECONCILE_INTENT_UNCERTAIN');
        return { resourceState: 'ABSENT', effects: effects.map(f => ({ effectId: f.effect_id, state: 'ABSENT' })) };
    }
    const tag = digest(`s01:t06:${ex.agency_id}:${ex.operation_id}:v1`);
    if (locator.database_name !== names.database || locator.runtime_role !== names.runtimeRole
        || locator.migration_role !== names.migrationRole || locator.secret_version !== 1 || locator.ownership_tag !== tag)
        throw new Error('RECONCILE_LOCATOR_DIVERGED');
    const passwords = {};
    for (const kind of ['runtime', 'migration'])
        passwords[kind] = await new FileSecretStore(e.private + '/t06-' + kind)
            .read({ agencyId: ex.agency_id, operationId: ex.operation_id,
            secretRef: kind === 'runtime' ? locator.secret_ref : locator.migration_secret_ref, version: 1, kind });
    if (roles.length !== 0 && roles.length !== 2)
        throw new Error('RECONCILE_ROLE_DIVERGED');
    for (const r of roles) {
        const kind = r.rolname === names.runtimeRole ? 'runtime' : 'migration';
        if (!r.rolcanlogin || r.tag !== `s01:t06:${ex.agency_id}:${ex.operation_id}:${kind}:v1`
            || ['rolsuper', 'rolcreatedb', 'rolcreaterole', 'rolinherit', 'rolreplication', 'rolbypassrls'].some(k => r[k] !== false))
            throw new Error('RECONCILE_ROLE_DIVERGED');
    }
    const memberships = (await admin.query(`SELECT r.rolname AS role,m.rolname AS member,
  a.grantor::regrole::text AS grantor,a.admin_option,a.inherit_option,a.set_option
  FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member
  WHERE r.rolname=ANY($1::text[]) OR m.rolname=ANY($1::text[])`, [[names.runtimeRole, names.migrationRole]])).rows;
    for (const m of memberships) {
        const implicit = m.grantor === 'synthetic_bootstrap' && m.admin_option && !m.inherit_option && !m.set_option;
        const temporary = m.role === names.migrationRole && m.grantor === 'provisioner_ddl'
            && !m.admin_option && !m.inherit_option && m.set_option;
        if (m.member !== 'provisioner_ddl' || (!implicit && !temporary))
            throw new Error('RECONCILE_MEMBERSHIP_DIVERGED');
    }
    if (roles.length && (!memberships.some(m => m.role === names.runtimeRole && !m.set_option)
        || !memberships.some(m => m.role === names.migrationRole && !m.set_option)))
        throw new Error('RECONCILE_MEMBERSHIP_DIVERGED');
    const creationText = effects.find(f => f.kind === 'DATABASE_CREATED')?.evidence?.creationPrecondition;
    let creation;
    if (creationText !== undefined) {
        creation = JSON.parse(creationText);
        if (Object.keys(creation).sort().join(',') !== 'agencyId,databaseAbsent,operationId,ownerOid,runtimeOid,targetVersion'
            || creation.agencyId !== ex.agency_id || creation.operationId !== ex.operation_id || creation.targetVersion !== 1
            || creation.databaseAbsent !== true || creation.ownerOid !== roles.find(r => r.rolname === names.migrationRole)?.oid
            || creation.runtimeOid !== roles.find(r => r.rolname === names.runtimeRole)?.oid)
            throw new Error('RECONCILE_CREATE_PRECONDITION_DIVERGED');
    }
    const actual = { agencyId: ex.agency_id, operationId: ex.operation_id,
        runtimeFingerprint: digest(passwords.runtime), migrationFingerprint: digest(passwords.migration), ...(creationText ? { creationPrecondition: creationText } : {}) };
    let marker, audit, runtimeAcl = false, inspectedClosedMigration = false, closedInspectionAccess;
    if (db) {
        const expectedTag = `s01:t06:${ex.agency_id}:${ex.operation_id}:database:v1`;
        if (roles.length !== 2 || db.owner !== names.migrationRole
            || (db.tag !== expectedTag && !(db.tag === null && db.datallowconn === false && creation)))
            throw new Error('RECONCILE_DATABASE_DIVERGED');
        const access = (await admin.query(`SELECT
   EXISTS(SELECT 1 FROM pg_database d,LATERAL aclexplode(COALESCE(d.datacl,acldefault('d',d.datdba))) a
     WHERE d.datname=$1 AND a.grantee=0 AND a.privilege_type='CONNECT') AS public_connect,
   EXISTS(SELECT 1 FROM pg_database d,LATERAL aclexplode(COALESCE(d.datacl,acldefault('d',d.datdba))) a
     WHERE d.datname=$1 AND a.grantee=0 AND a.privilege_type='TEMPORARY') AS public_temp,
   has_database_privilege($2,$1,'CONNECT') AS runtime_connect,
   (SELECT count(*)::int FROM pg_stat_activity WHERE datname=$1) AS sessions`, [names.database, names.runtimeRole])).rows[0];
        if (access.sessions || (db.datallowconn && (access.public_connect || access.public_temp)))
            throw new Error('RECONCILE_DATABASE_NOT_DRAINED');
        if (!db.datallowconn) {
            const migrationIssued = (await central.query(`SELECT EXISTS(SELECT 1 FROM control.provisioning_execution e,
    jsonb_array_elements(e.backends) b WHERE e.operation_id=$1 AND b->>'kind'='migration') AS issued`, [ex.operation_id])).rows[0].issued;
            if (migrationIssued) {
                // Host-only maintenance after the exact emitter and backends were fenced.
                // Runtime CONNECT remains revoked throughout; the migration session is read-only.
                const unexpectedConnect = (await admin.query(`SELECT count(*)::int AS n FROM pg_database d,
                  LATERAL aclexplode(COALESCE(d.datacl,acldefault('d',d.datdba))) a WHERE d.datname=$1 AND a.privilege_type='CONNECT'
                  AND a.grantee<>$2::regrole`, [names.database, names.migrationRole])).rows[0].n;
                if (!allowClosedMigratedInspection || !creation || db.tag !== expectedTag
                    || access.runtime_connect !== false || access.public_connect !== false
                    || access.public_temp !== false || unexpectedConnect || effects.some(f => f.status !== 'CONFIRMED'))
                    throw new Error('RECONCILE_CLOSED_DATABASE_REQUIRES_INSPECTION');
                inspectedClosedMigration = true;
                closedInspectionAccess = { ...access, unexpectedConnect };
            }
            else if (!creation || effects.some(f => ['SCHEMA_MIGRATED', 'RUNTIME_ACL', 'AUDIT_CONFIRMED'].includes(f.kind) && f.status !== 'PLANNED'))
                throw new Error('RECONCILE_CLOSED_DATABASE_REQUIRES_INSPECTION');
        }
        Object.assign(actual, { databaseOid: db.oid, databaseOwner: db.owner, databaseTag: db.tag });
        for (const role of roles)
            actual[role.rolname === names.runtimeRole ? 'runtimeOid' : 'migrationOid'] = role.oid;
        if (db.datallowconn || inspectedClosedMigration) {
            const pool = new Pool({ host: '127.0.0.1', port: e.pgPort, database: names.database, user: names.migrationRole,
                password: passwords.migration.toString(), max: 1, connectionTimeoutMillis: 2000, statement_timeout: 5000, query_timeout: 5000 });
            try {
                if (inspectedClosedMigration)
                    await admin.query(`ALTER DATABASE "${names.database}" ALLOW_CONNECTIONS true`);
                const client = await pool.connect();
                try {
                    await client.query('BEGIN READ ONLY');
                    const ledger = (await client.query("SELECT to_regclass('s01_migration.version') AS ledger")).rows[0].ledger;
                    if (ledger) {
                        await new AgencyRepository().verify(client, ex.agency_id);
                        marker = (await client.query('SELECT migration_checksum,schema_version FROM agency_metadata WHERE singleton=true')).rows[0];
                        const event = effects.find(f => f.kind === 'AUDIT_CONFIRMED');
                        audit = event ? (await client.query('SELECT event_type,resource_version::text,correlation FROM audit_event WHERE event_id=$1', [event.audit_event_id])).rows[0] : null;
                        if (audit && (audit.event_type !== 'agency.provisioning.verified' || audit.resource_version !== '1' || audit.correlation !== ex.operation_id))
                            throw new Error('RECONCILE_AUDIT_DIVERGED');
                    }
                    else if ((await client.query("SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','business') AND c.relkind IN ('r','p','S','v','m','f')")).rows[0].n)
                        throw new Error('RECONCILE_SCHEMA_UNOWNED');
                    if (access.runtime_connect || inspectedClosedMigration) {
                        if (!marker)
                            throw new Error('RECONCILE_RUNTIME_BEFORE_SCHEMA');
                        await new AgencyRepository().verifyRuntimeAcl(client, names.runtimeRole, names.migrationRole, !inspectedClosedMigration);
                        runtimeAcl = true;
                    }
                    await client.query('ROLLBACK');
                }
                finally {
                    await client.query('ROLLBACK').catch(() => { });
                    client.release();
                }
            }
            finally {
                try {
                    await pool.end();
                }
                finally {
                  if (inspectedClosedMigration) {
                    await admin.query(`ALTER DATABASE "${names.database}" ALLOW_CONNECTIONS false`);
                    const closed = (await admin.query(`SELECT datallowconn,
                      (SELECT count(*)::int FROM pg_stat_activity WHERE datname=$1) AS sessions
                      FROM pg_database WHERE datname=$1`, [names.database])).rows[0];
                    if (!closed || closed.datallowconn || closed.sessions)
                        throw new Error('RECONCILE_INSPECTION_NOT_RECLOSED');
                  }
                }
            }
        }
    }
    const intention = { agencyId: ex.agency_id, ...names, secretRef: locator.secret_ref,
        migrationSecretRef: locator.migration_secret_ref, ownershipTag: locator.ownership_tag };
    const resolved = [];
    for (const effect of effects) {
        if (effect.status === 'UNCERTAIN')
            throw new Error('RECONCILE_EFFECT_UNCERTAIN');
        const expected = digest(JSON.stringify(effect.kind === 'LOCATOR_RESERVED' ? intention : { kind: effect.kind, ...intention }));
        if (effect.expected_fingerprint !== expected)
            throw new Error('RECONCILE_INTENT_DIVERGED');
        const present = effect.kind === 'LOCATOR_RESERVED' || effect.kind === 'SECRET_PUBLISHED'
            || (effect.kind === 'DATABASE_CREATED' && !!db && (db.datallowconn || inspectedClosedMigration)) || (effect.kind === 'SCHEMA_MIGRATED' && !!marker)
            || (effect.kind === 'RUNTIME_ACL' && runtimeAcl) || (effect.kind === 'AUDIT_CONFIRMED' && !!audit);
        if (effect.status === 'CONFIRMED') {
            if (!present)
                throw new Error('RECONCILE_CONFIRMED_EFFECT_MISSING');
            const evidence = effect.evidence;
            for (const [name, value] of Object.entries(evidence)) {
                const current = name === 'schemaVersion' ? marker?.schema_version : name === 'migrationChecksum' ? marker?.migration_checksum :
                    name in intention ? intention[name] : actual[name];
                if (current !== value)
                    throw new Error('RECONCILE_EVIDENCE_DIVERGED');
            }
        }
        resolved.push({ effectId: effect.effect_id, kind: effect.kind, state: present ? 'PRESENT' : 'ABSENT' });
    }
    return { resourceState: db ? (db.datallowconn ? 'DATABASE' : inspectedClosedMigration ? 'CLOSED_DATABASE_VERIFIED' : 'CLOSED_DATABASE_UNMIGRATED') : roles.length ? 'ROLES' : 'SECRETS', effects: resolved,
        fingerprint: digest(JSON.stringify(actual)), markerVerified: !!marker, aclVerified: runtimeAcl, auditVerified: !!audit,
        ...(closedInspectionAccess ? { closedInspectionAccess, inspectionReclosed: true } : {}) };
}
