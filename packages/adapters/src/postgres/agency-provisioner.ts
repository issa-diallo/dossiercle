import { randomBytes, createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { FileSecretStore } from '../secrets/secret-store.js';
import { migrate } from './migrate.js';
import { AgencyRepository } from './agency.repository.js';
export interface AgencyResources {
    agencyId: string;
    operationId: string;
    database: string;
    runtimeRole: string;
    migrationRole: string;
    ownershipTag: string;
    secretRef: string;
    migrationSecretRef: string;
    runtimePassword: Buffer;
    migrationPassword: Buffer;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
export interface ProvisioningEffects {
    run<T>(kind: 'SECRET_PUBLISHED' | 'DATABASE_CREATED' | 'SCHEMA_MIGRATED' | 'RUNTIME_ACL', work: () => Promise<T>, phase?: 'ROLES' | 'DATABASE'): Promise<T>;
    databaseCreationPrecondition?(): Promise<{
        ownerOid: string;
        runtimeOid: string;
    }>;
    boundary?(stage: string): Promise<void>;
    backend(client: PoolClient, kind: 'ddl' | 'migration'): Promise<void>;
    beforeStatement?(): Promise<void>;
    assertAlive(): void;
}
export class AgencyProvisioner {
    constructor(private readonly ddl: Pool, private readonly secrets: FileSecretStore, private readonly host: string, private readonly port: number, private readonly migrationSecrets: FileSecretStore = secrets, private readonly effects?: ProvisioningEffects) { }
    private async effect<T>(kind: 'SECRET_PUBLISHED' | 'DATABASE_CREATED' | 'SCHEMA_MIGRATED' | 'RUNTIME_ACL', work: () => Promise<T>, phase?: 'ROLES' | 'DATABASE'): Promise<T> {
        this.effects?.assertAlive();
        return this.effects ? this.effects.run(kind, work, phase) : work();
    }
    private async ddlClient(): Promise<PoolClient> {
        this.effects?.assertAlive();
        const client = await this.ddl.connect();
        try {
            await this.effects?.backend(client, 'ddl');
            return this.guarded(client);
        }
        catch (error) {
            client.release(true);
            throw error;
        }
    }
    private guarded(client: PoolClient): PoolClient {
        if (!this.effects)
            return client;
        const before = this.effects.beforeStatement;
        return new Proxy(client, { get(target, property) {
                if (property === 'query')
                    return async (...args: unknown[]) => {
                        await before?.();
                        return Reflect.apply(target.query, target, args);
                    };
                const value = Reflect.get(target, property, target);
                return typeof value === 'function' ? value.bind(target) : value;
            } });
    }
    async prepare(input: {
        agencyId: string;
        operationId: string;
        runtimeSecretRef: string;
        migrationSecretRef: string;
        allowSecretCreation?: boolean;
        assertIntent: () => Promise<void>;
        assertMigrationIntent: () => Promise<void>;
    }): Promise<AgencyResources> {
        if (!uuid.test(input.agencyId) || !uuid.test(input.operationId) || !uuid.test(input.runtimeSecretRef) || !uuid.test(input.migrationSecretRef))
            throw new Error('AGENCY_RESOURCE_INPUT_REFUSED');
        await input.assertIntent();
        const compact = input.agencyId.replaceAll('-', '');
        const database = `ag_${compact}`, runtimeRole = `agr_${compact}`, migrationRole = `agm_${compact}`;
        const ownershipTag = createHash('sha256').update(`s01:t06:${input.agencyId}:${input.operationId}:v1`).digest('hex');
        const runtimeBinding = { agencyId: input.agencyId, operationId: input.operationId, secretRef: input.runtimeSecretRef, version: 1, kind: 'runtime' as const };
        const migrationBinding = { agencyId: input.agencyId, operationId: input.operationId, secretRef: input.migrationSecretRef, version: 1, kind: 'migration' as const };
        const [savedRuntime, savedMigration] = await Promise.all([this.secrets.read(runtimeBinding).catch(e => {
                if ((e as NodeJS.ErrnoException).code === 'ENOENT')
                    return null;
                throw e;
            }), this.migrationSecrets.read(migrationBinding).catch(e => {
                if ((e as NodeJS.ErrnoException).code === 'ENOENT')
                    return null;
                throw e;
            })]);
        if ((savedRuntime === null) !== (savedMigration === null))
            throw new Error('SECRET_PAIR_UNCERTAIN');
        if (savedRuntime === null) {
            if (input.allowSecretCreation === false)
                throw new Error('SECRET_VERSION_MISSING');
            const existing = await this.ddl.query('SELECT 1 FROM pg_roles WHERE rolname=ANY($1::text[]) LIMIT 1', [[runtimeRole, migrationRole]]);
            if (existing.rowCount)
                throw new Error('SECRET_VERSION_MISSING');
        }
        const runtimePassword = savedRuntime ?? Buffer.from(randomBytes(32).toString('base64url'), 'utf8'), migrationPassword = savedMigration ?? Buffer.from(randomBytes(32).toString('base64url'), 'utf8');
        const resources = { agencyId: input.agencyId, operationId: input.operationId, database, runtimeRole, migrationRole, ownershipTag, secretRef: input.runtimeSecretRef, migrationSecretRef: input.migrationSecretRef, runtimePassword, migrationPassword };
        await this.effect('SECRET_PUBLISHED', async () => {
            if (!savedRuntime) {
                await this.secrets.publish(runtimeBinding, runtimePassword);
                await this.migrationSecrets.publish(migrationBinding, migrationPassword);
            }
        });
        let databaseOwned = false;
        try {
            await this.effect('DATABASE_CREATED', () => this.createRoles(resources), 'ROLES');
            await this.effect('DATABASE_CREATED', async () => { databaseOwned = await this.createClosedDatabase(resources); }, 'DATABASE');
            await input.assertMigrationIntent();
            await this.effect('SCHEMA_MIGRATED', async () => {
                const migrationPool = await this.migrationPool(resources), client = await migrationPool.connect();
                try {
                    await this.effects?.backend(client, 'migration');
                    await migrate(this.guarded(client), 'agency', resources.agencyId);
                    await new AgencyRepository().verify(this.guarded(client), resources.agencyId);
                }
                finally {
                    client.release();
                    await migrationPool.end();
                }
            });
            await this.effect('RUNTIME_ACL', () => this.installRuntimeAcl(resources));
            return resources;
        }
        catch (error) {
            this.effects?.assertAlive();
            if (databaseOwned)
                try {
                    await this.effect('DATABASE_CREATED', () => this.closeAndFenceDatabase(resources));
                }
                catch (closeError) {
                    throw new AggregateError([error, closeError], 'AGENCY_PROVISIONING_UNCERTAIN_DATABASE_NOT_FENCED');
                }
            throw error;
        }
    }
    private async createRoles(r: AgencyResources): Promise<void> {
        const c = await this.ddlClient();
        try {
            await c.query('BEGIN');
            await c.query("SET LOCAL password_encryption='scram-sha-256'");
            for (const [role, password, kind] of [[r.migrationRole, r.migrationPassword.toString(), 'migration'], [r.runtimeRole, r.runtimePassword.toString(), 'runtime']] as const) {
                const found = (await c.query('SELECT oid,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=$1', [role])).rows[0];
                const comment = `s01:t06:${r.agencyId}:${r.operationId}:${kind}:v1`;
                if (found) {
                    const existing = (await c.query('SELECT shobj_description($1,\'pg_authid\') AS comment', [found.oid])).rows[0]?.comment;
                    if (existing !== comment || found.rolcanlogin !== true || Object.entries(found).some(([k, v]) => k !== 'oid' && k !== 'rolcanlogin' && v !== false))
                        throw new Error('AGENCY_ROLE_CONFLICT');
                    continue;
                }
                await c.query(`CREATE ROLE ${identifier(role)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD ${literal(password)}`);
                await c.query(`COMMENT ON ROLE ${identifier(role)} IS ${literal(comment)}`);
            }
            const memberships = await c.query(`SELECT role.rolname AS role,member.rolname AS member,m.admin_option,m.inherit_option,m.set_option,m.grantor::regrole::text AS grantor FROM pg_auth_members m JOIN pg_roles role ON role.oid=m.roleid JOIN pg_roles member ON member.oid=m.member WHERE role.rolname=ANY($1::text[]) OR member.rolname=ANY($1::text[])`, [[r.runtimeRole, r.migrationRole]]);
            const allowed = (m: {
                role: string;
                member: string;
                admin_option: boolean;
                inherit_option: boolean;
                set_option: boolean;
                grantor: string;
            }) => m.member === 'provisioner_ddl' && m.grantor === 'synthetic_bootstrap' && m.admin_option && !m.inherit_option && !m.set_option
                && [r.runtimeRole, r.migrationRole].includes(m.role);
            const expectedSet = (m: {
                role: string;
                member: string;
                admin_option: boolean;
                inherit_option: boolean;
                set_option: boolean;
                grantor: string;
            }) => m.role === r.migrationRole && m.member === 'provisioner_ddl' && m.grantor === 'provisioner_ddl' && !m.admin_option && !m.inherit_option && m.set_option;
            const unexpected = memberships.rows.filter(m => !allowed(m) && !expectedSet(m));
            if (unexpected.length)
                throw new Error('AGENCY_ROLE_MEMBERSHIP_CONFLICT');
            const setMembership = memberships.rows.some(expectedSet);
            if (!setMembership)
                await c.query(`GRANT ${identifier(r.migrationRole)} TO provisioner_ddl WITH INHERIT FALSE, SET TRUE, ADMIN FALSE`);
            const afterGrant = await c.query(`SELECT role.rolname AS role,member.rolname AS member,m.admin_option,m.inherit_option,m.set_option,m.grantor::regrole::text AS grantor FROM pg_auth_members m JOIN pg_roles role ON role.oid=m.roleid JOIN pg_roles member ON member.oid=m.member WHERE role.rolname=ANY($1::text[]) OR member.rolname=ANY($1::text[]) ORDER BY role.rolname`, [[r.runtimeRole, r.migrationRole]]);
            if (afterGrant.rows.length !== 3 || !afterGrant.rows.some(m => m.role === r.runtimeRole && allowed(m)) || !afterGrant.rows.some(m => m.role === r.migrationRole && allowed(m)) || !afterGrant.rows.some(expectedSet))
                throw new Error('AGENCY_ROLE_MEMBERSHIP_DIVERGED_AFTER_SET_GRANT');
            await c.query('COMMIT');
        }
        catch (e) {
            await c.query('ROLLBACK');
            throw e;
        }
        finally {
            c.release();
        }
    }
    private async createClosedDatabase(r: AgencyResources): Promise<boolean> {
        let owned = false;
        let failure: unknown;
        const c = await this.ddlClient();
        try {
            const existing = (await c.query('SELECT d.oid,d.datdba::regrole::text AS owner,d.datdba::text AS owner_oid,d.datallowconn,shobj_description(d.oid,\'pg_database\') AS comment FROM pg_database d WHERE d.datname=$1', [r.database])).rows[0];
            const tag = `s01:t06:${r.agencyId}:${r.operationId}:database:v1`;
            if (existing) {
                if (existing.owner !== r.migrationRole)
                    throw new Error('AGENCY_DATABASE_CONFLICT');
                if (existing.comment !== tag) {
                    if (existing.comment !== null || existing.datallowconn !== false || !this.effects?.databaseCreationPrecondition)
                        throw new Error('AGENCY_DATABASE_CONFLICT');
                    const proof = await this.effects.databaseCreationPrecondition();
                    const runtime = (await c.query('SELECT oid::text FROM pg_roles WHERE rolname=$1', [r.runtimeRole])).rows[0];
                    if (proof.ownerOid !== existing.owner_oid || proof.runtimeOid !== runtime?.oid)
                        throw new Error('AGENCY_DATABASE_CONFLICT');
                    await this.asRole(c, r.migrationRole, () => c.query(`COMMENT ON DATABASE ${identifier(r.database)} IS ${literal(tag)}`));
                }
                owned = true;
                if (existing.datallowconn === false)
                    await this.asRole(c, r.migrationRole, async () => { await c.query(`REVOKE ALL ON DATABASE ${identifier(r.database)} FROM PUBLIC`); await c.query(`REVOKE TEMPORARY ON DATABASE ${identifier(r.database)} FROM PUBLIC`); await c.query(`REVOKE CONNECT ON DATABASE ${identifier(r.database)} FROM ${identifier(r.runtimeRole)}`); await c.query(`GRANT CONNECT ON DATABASE ${identifier(r.database)} TO ${identifier(r.migrationRole)}`); await this.effects?.boundary?.('DATABASE_REVOKED'); await c.query(`ALTER DATABASE ${identifier(r.database)} ALLOW_CONNECTIONS true`); await this.effects?.boundary?.('DATABASE_OPENED'); });
                else {
                    const acl = (await c.query(`SELECT has_database_privilege('public',$1,'CONNECT') AS public_connect,has_database_privilege($2,$1,'CONNECT') AS migration_connect,has_database_privilege($3,$1,'CONNECT') AS runtime_connect FROM pg_database WHERE datname=$1`, [r.database, r.migrationRole, r.runtimeRole])).rows[0];
                    if (acl?.public_connect !== false || acl?.migration_connect !== true || typeof acl?.runtime_connect !== 'boolean')
                        throw new Error('AGENCY_DATABASE_ACL_CONFLICT');
                }
            }
            else {
                await c.query(`CREATE DATABASE ${identifier(r.database)} OWNER ${identifier(r.migrationRole)} ALLOW_CONNECTIONS false`);
                owned = true;
                await this.effects?.boundary?.('DATABASE_CREATED_CLOSED');
                await this.asRole(c, r.migrationRole, async () => { await c.query(`COMMENT ON DATABASE ${identifier(r.database)} IS ${literal(tag)}`); await this.effects?.boundary?.('DATABASE_COMMENTED'); await c.query(`REVOKE ALL ON DATABASE ${identifier(r.database)} FROM PUBLIC`); await c.query(`REVOKE TEMPORARY ON DATABASE ${identifier(r.database)} FROM PUBLIC`); await c.query(`REVOKE CONNECT ON DATABASE ${identifier(r.database)} FROM ${identifier(r.runtimeRole)}`); await c.query(`GRANT CONNECT ON DATABASE ${identifier(r.database)} TO ${identifier(r.migrationRole)}`); await this.effects?.boundary?.('DATABASE_REVOKED'); await c.query(`ALTER DATABASE ${identifier(r.database)} ALLOW_CONNECTIONS true`); await this.effects?.boundary?.('DATABASE_OPENED'); });
                const verified = (await c.query('SELECT d.oid,d.datdba::regrole::text AS owner,d.datdba::text AS owner_oid,d.datallowconn,shobj_description(d.oid,\'pg_database\') AS comment FROM pg_database d WHERE d.datname=$1', [r.database])).rows[0];
                if (!verified || verified.owner !== r.migrationRole || verified.datallowconn !== true || verified.comment !== tag)
                    throw new Error('AGENCY_DATABASE_READBACK_FAILED');
            }
        }
        catch (error) {
            failure = error;
        }
        finally {
            c.release();
        }
        if (failure !== undefined) {
            if (owned)
                try {
                    await this.closeAndFenceDatabase(r);
                }
                catch (closeError) {
                    throw new AggregateError([failure, closeError], 'AGENCY_DATABASE_SETUP_UNCERTAIN');
                }
            throw failure;
        }
        try {
            const c2 = await this.ddlClient();
            try {
                await this.revokeDdlMembership(c2, r.migrationRole);
            }
            finally {
                c2.release();
            }
        }
        catch (error) {
            try {
                await this.closeAndFenceDatabase(r);
            }
            catch (closeError) {
                throw new AggregateError([error, closeError], 'AGENCY_DATABASE_SETUP_UNCERTAIN');
            }
            throw error;
        }
        return true;
    }
    private async revokeDdlMembership(client: PoolClient, role: string) { await client.query(`REVOKE ${identifier(role)} FROM provisioner_ddl`); }
    private async asRole<T>(client: PoolClient, role: string, work: () => Promise<T>): Promise<T> {
        await client.query(`SET ROLE ${identifier(role)}`);
        try {
            return await work();
        }
        finally {
            await client.query('RESET ROLE').catch(() => { });
        }
    }
    private async installRuntimeAcl(r: AgencyResources): Promise<void> {
        const pool = await this.migrationPool(r), raw = await pool.connect();
        try {
            await this.effects?.backend(raw, 'migration');
            const client = this.guarded(raw);
            await client.query('BEGIN');
            await client.query(`REVOKE ALL ON DATABASE ${identifier(r.database)} FROM PUBLIC`);
            await client.query(`REVOKE TEMPORARY ON DATABASE ${identifier(r.database)} FROM PUBLIC`);
            await client.query(`GRANT CONNECT ON DATABASE ${identifier(r.database)} TO ${identifier(r.runtimeRole)},${identifier(r.migrationRole)}`);
            await client.query(`CREATE SCHEMA IF NOT EXISTS business AUTHORIZATION ${identifier(r.migrationRole)}`);
            const business = (await client.query(`SELECT nspowner::regrole::text AS owner,(SELECT count(*) FROM pg_class c WHERE c.relnamespace=n.oid AND c.relkind IN ('r','p','S','v','m','f')) AS objects FROM pg_namespace n WHERE nspname='business'`)).rows[0];
            if (business?.owner !== r.migrationRole || Number(business.objects) !== 0)
                throw new Error('AGENCY_BUSINESS_SCHEMA_DIVERGED');
            await client.query(`REVOKE ALL ON SCHEMA business FROM PUBLIC`);
            await client.query(`REVOKE ALL ON SCHEMA public FROM PUBLIC`);
            await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${identifier(r.migrationRole)} IN SCHEMA public REVOKE SELECT,INSERT,UPDATE,DELETE ON TABLES FROM ${identifier(r.runtimeRole)}`);
            await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${identifier(r.migrationRole)} IN SCHEMA public REVOKE USAGE,SELECT ON SEQUENCES FROM ${identifier(r.runtimeRole)}`);
            await client.query(`GRANT USAGE ON SCHEMA public TO ${identifier(r.runtimeRole)}`);
            await client.query(`GRANT SELECT ON agency_metadata,agency_configuration,audit_event TO ${identifier(r.runtimeRole)}`);
            await client.query(`GRANT USAGE ON SCHEMA s01_migration TO ${identifier(r.runtimeRole)}`);
            await client.query(`GRANT SELECT ON s01_migration.version TO ${identifier(r.runtimeRole)}`);
            await client.query(`GRANT USAGE ON SCHEMA business TO ${identifier(r.runtimeRole)}`);
            await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${identifier(r.migrationRole)} IN SCHEMA business GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO ${identifier(r.runtimeRole)}`);
            await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${identifier(r.migrationRole)} IN SCHEMA business GRANT USAGE,SELECT ON SEQUENCES TO ${identifier(r.runtimeRole)}`);
            await client.query('COMMIT');
            const privileges = (await client.query(`SELECT has_database_privilege($1,current_database(),'CONNECT') AS can_connect,
        has_database_privilege($1,current_database(),'CREATE') AS can_create_db,has_schema_privilege($1,'public','CREATE') AS can_create_schema,
        has_table_privilege($1,'agency_configuration','UPDATE') AS can_update_config,
        has_table_privilege($1,'agency_metadata','UPDATE') AS can_update_metadata,has_table_privilege($1,'audit_event','INSERT') AS can_insert_audit,has_database_privilege($1,current_database(),'TEMP') AS can_temp,has_schema_privilege($1,'public','CREATE') AS can_create_public,has_schema_privilege($1,'business','USAGE') AS business_usage,has_schema_privilege($1,'business','CREATE') AS business_create FROM pg_roles WHERE rolname=$1`, [r.runtimeRole])).rows[0];
            if (!privileges || privileges.can_connect !== true || privileges.can_create_db !== false || privileges.can_create_schema !== false || privileges.can_update_config !== false || privileges.can_update_metadata !== false || privileges.can_insert_audit !== false || privileges.can_temp !== false || privileges.can_create_public !== false || privileges.business_usage !== true || privileges.business_create !== false)
                throw new Error('AGENCY_RUNTIME_ACL_DIVERGED');
        }
        catch (e) {
            await this.guarded(raw).query('ROLLBACK').catch(() => { });
            throw e;
        }
        finally {
            raw.release();
            await pool.end();
        }
    }
    async closeAndFenceDatabase(resources: AgencyResources): Promise<void> {
        const { database, runtimeRole, migrationRole } = resources;
        const c = await this.ddlClient();
        const failures: unknown[] = [];
        try {
            const found = (await c.query('SELECT datallowconn FROM pg_database WHERE datname=$1', [database])).rows[0];
            if (!found)
                return;
            try {
                await c.query(`GRANT ${identifier(migrationRole)} TO provisioner_ddl WITH INHERIT FALSE, SET TRUE, ADMIN FALSE`);
                await c.query(`SET ROLE ${identifier(migrationRole)}`);
                await c.query(`REVOKE ALL ON DATABASE ${identifier(database)} FROM PUBLIC`);
                await c.query(`REVOKE CONNECT ON DATABASE ${identifier(database)} FROM ${identifier(runtimeRole)}`);
                await c.query(`REVOKE TEMPORARY ON DATABASE ${identifier(database)} FROM PUBLIC`);
                await c.query(`ALTER DATABASE ${identifier(database)} ALLOW_CONNECTIONS false`);
            }
            catch (error) {
                failures.push(error);
            }
            finally {
                try {
                    await c.query('RESET ROLE');
                }
                catch (error) {
                    failures.push(error);
                }
                try {
                    await c.query(`REVOKE ${identifier(migrationRole)} FROM provisioner_ddl`);
                }
                catch (error) {
                    failures.push(error);
                }
            }
            try {
                const verified = (await c.query(`SELECT d.datallowconn,(SELECT count(*) FROM pg_stat_activity a WHERE a.datname=d.datname) AS sessions,
          EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.roleid=(SELECT oid FROM pg_roles WHERE rolname=$1) AND m.member=(SELECT oid FROM pg_roles WHERE rolname='provisioner_ddl') AND m.set_option) AS set_remaining
          FROM pg_database d WHERE d.datname=$2`, [migrationRole, database])).rows[0];
                if (verified?.datallowconn !== false || Number(verified.sessions) !== 0 || verified.set_remaining !== false)
                    failures.push(new Error('AGENCY_DATABASE_FENCE_UNVERIFIED'));
            }
            catch (error) {
                failures.push(error);
            }
            if (failures.length)
                throw new AggregateError(failures, 'AGENCY_DATABASE_FENCE_UNCERTAIN');
        }
        finally {
            c.release();
        }
    }
    async migrationPool(resources: AgencyResources): Promise<Pool> {
        const { Pool } = await import('pg');
        return new Pool({ host: this.host, port: this.port, database: resources.database, user: resources.migrationRole, password: resources.migrationPassword.toString(), max: 1, connectionTimeoutMillis: 2000, idleTimeoutMillis: 60000, statement_timeout: 10000, query_timeout: 12000 });
    }
}
