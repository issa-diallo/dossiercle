import { mkdtemp, chmod, rm, mkdir, rename, lstat } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { AgencyProvisioner } from '../src/postgres/agency-provisioner.js';
import { FileSecretStore } from '../src/secrets/secret-store.js';
import { AgencyRepository } from '../src/postgres/agency.repository.js';
import { assertSchema } from '../src/postgres/migrate.js';
const env = JSON.parse(await (await import('node:fs/promises')).readFile('.local/environment.json', 'utf8')) as {
    root: string;
    private: string;
    pgPort: number;
    syntheticOnly: boolean;
};
if (!env.syntheticOnly || env.root !== process.cwd())
    throw new Error('SYNTHETIC_REQUIRED');
const agencyId = randomUUID(), operationId = randomUUID(), runtimeSecretRef = randomUUID(), migrationSecretRef = randomUUID();
const partial = { agencyId: randomUUID(), operationId: randomUUID(), runtimeSecretRef: randomUUID(), migrationSecretRef: randomUUID() };
const second = { agencyId: randomUUID(), operationId: randomUUID(), runtimeSecretRef: randomUUID(), migrationSecretRef: randomUUID() };
const extras = Array.from({ length: 3 }, () => ({ agencyId: randomUUID(), operationId: randomUUID(), runtimeSecretRef: randomUUID(), migrationSecretRef: randomUUID() }));
let scratch: string, ddl: Pool, bootstrap: Pool;
beforeAll(async () => { scratch = await mkdtemp(join(tmpdir(), 't06-provision-')); await chmod(scratch, 0o700); ddl = new Pool({ host: '127.0.0.1', port: env.pgPort, database: 'postgres', user: 'provisioner_ddl', password: (await (await import('node:fs/promises')).readFile(`${env.private}/pg/provisioner_ddl`, 'utf8')).trim(), max: 1 }); bootstrap = new Pool({ host: '127.0.0.1', port: env.pgPort, database: 'postgres', user: 'synthetic_bootstrap', password: (await (await import('node:fs/promises')).readFile(`${env.private}/pg/bootstrap`, 'utf8')).trim(), max: 1 }); });
afterAll(async () => {
    if (bootstrap) {
        for (const id of [agencyId, partial.agencyId, second.agencyId, ...extras.map(e => e.agencyId)]) {
            const compact = id.replaceAll('-', ''), database = `ag_${compact}`, runtimeRole = `agr_${compact}`, migrationRole = `agm_${compact}`;
            const c = await bootstrap.connect();
            try {
                await c.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [database]);
                await c.query(`DROP DATABASE IF EXISTS "${database}"`);
                await c.query(`DROP ROLE IF EXISTS "${runtimeRole}"`);
                await c.query(`DROP ROLE IF EXISTS "${migrationRole}"`);
            }
            finally {
                c.release();
            }
        }
    }
    await ddl?.end();
    await bootstrap?.end();
    if (scratch)
        await rm(scratch, { recursive: true, force: true });
});
describe('T06 isolated PostgreSQL agency provisioner', () => {
    it('creates a closed, tagged tenant, applies its immutable schema and replays the same credentials', async () => {
        const store = new FileSecretStore(join(scratch, 'vault'));
        await (await import('node:fs/promises')).mkdir(join(scratch, 'vault'), { mode: 0o700 });
        const manager = new AgencyProvisioner(ddl, store, '127.0.0.1', env.pgPort);
        let intentions = 0;
        const args = { agencyId, operationId, runtimeSecretRef, migrationSecretRef, assertIntent: async () => { intentions++; }, assertMigrationIntent: async () => { intentions++; } };
        const resources = await manager.prepare(args);
        const replay = await manager.prepare(args);
        expect(intentions).toBe(4);
        expect(replay.runtimePassword.equals(resources.runtimePassword)).toBe(true);
        expect(replay.migrationPassword.equals(resources.migrationPassword)).toBe(true);
        const migrationPool = await manager.migrationPool(resources), client = await migrationPool.connect();
        try {
            await assertSchema(client, 'agency');
            expect((await client.query('SELECT agency_id,schema_version FROM agency_metadata WHERE singleton=true')).rows).toEqual([{ agency_id: agencyId, schema_version: 1 }]);
            expect((await client.query('SELECT automation_enabled,modules_enabled,mail_connected FROM agency_configuration')).rows[0]).toEqual({ automation_enabled: false, modules_enabled: false, mail_connected: false });
        }
        finally {
            client.release();
            await migrationPool.end();
        }
        const catalog = await ddl.query(`SELECT role.rolname AS role,member.rolname AS member,m.admin_option,m.inherit_option,m.set_option,m.grantor::regrole::text AS grantor FROM pg_auth_members m JOIN pg_roles role ON role.oid=m.roleid JOIN pg_roles member ON member.oid=m.member WHERE role.rolname=ANY($1::text[]) OR member.rolname=ANY($1::text[]) ORDER BY role.rolname`, [[resources.runtimeRole, resources.migrationRole]]);
        expect(catalog.rows).toEqual([
            { role: resources.migrationRole, member: 'provisioner_ddl', admin_option: true, inherit_option: false, set_option: false, grantor: 'synthetic_bootstrap' },
            { role: resources.runtimeRole, member: 'provisioner_ddl', admin_option: true, inherit_option: false, set_option: false, grantor: 'synthetic_bootstrap' },
        ]);
        expect(catalog.rows.some(row => row.role === resources.migrationRole && row.member === 'provisioner_ddl' && row.set_option)).toBe(false);
        const ddlClient = await ddl.connect();
        try {
            await expect(ddlClient.query(`SET ROLE "${resources.runtimeRole}"`)).rejects.toMatchObject({ code: '42501' });
        }
        finally {
            await ddlClient.query('RESET ROLE').catch(() => { });
            ddlClient.release();
        }
        const runtime = new Pool({ host: '127.0.0.1', port: env.pgPort, database: resources.database, user: resources.runtimeRole, password: resources.runtimePassword.toString(), max: 1 });
        try {
            await expect(runtime.query('UPDATE agency_metadata SET schema_version=1')).rejects.toMatchObject({ code: '42501' });
            await expect(runtime.query('INSERT INTO audit_event DEFAULT VALUES')).rejects.toMatchObject({ code: '42501' });
            await expect(runtime.query('CREATE TABLE forbidden(id integer)')).rejects.toMatchObject({ code: '42501' });
            await expect(runtime.query('CREATE TEMP TABLE forbidden(id integer)')).rejects.toMatchObject({ code: '42501' });
            const canary = 't06_business_' + agencyId.replaceAll('-', ''), publicCanary = 't06_public_' + agencyId.replaceAll('-', '');
            const migration2 = await manager.migrationPool(resources), mc = await migration2.connect();
            try {
                await mc.query(`CREATE TABLE business."${canary}" (id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, value text)`);
                await mc.query(`CREATE TABLE public."${publicCanary}" (id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, value text)`);
            }
            finally {
                mc.release();
                await migration2.end();
            }
            await expect(runtime.query(`INSERT INTO public."${publicCanary}" (value) VALUES ('forbidden')`)).rejects.toMatchObject({ code: '42501' });
            await expect(runtime.query(`SELECT value FROM public."${publicCanary}"`)).rejects.toMatchObject({ code: '42501' });
            await runtime.query(`INSERT INTO business."${canary}" (value) VALUES ('ok')`);
            expect((await runtime.query(`SELECT value FROM business."${canary}"`)).rows).toEqual([{ value: 'ok' }]);
            const migration3 = await manager.migrationPool(resources), mc3 = await migration3.connect();
            try {
                await mc3.query(`DROP TABLE business."${canary}"`);
                await mc3.query(`DROP TABLE public."${publicCanary}"`);
            }
            finally {
                mc3.release();
                await migration3.end();
            }
            const secondStorePath = join(scratch, 'second-vault');
            await (await import('node:fs/promises')).mkdir(secondStorePath, { mode: 0o700 });
            const secondManager = new AgencyProvisioner(ddl, new FileSecretStore(secondStorePath), '127.0.0.1', env.pgPort);
            const secondResources = await secondManager.prepare({ ...second, assertIntent: async () => { }, assertMigrationIntent: async () => { } });
            const crossAgency = new Pool({ host: '127.0.0.1', port: env.pgPort, database: secondResources.database, user: resources.runtimeRole, password: resources.runtimePassword.toString(), max: 1 });
            try {
                await expect(crossAgency.query('SELECT 1')).rejects.toMatchObject({ code: '42501' });
            }
            finally {
                await crossAgency.end();
            }
            const central = new Pool({ host: '127.0.0.1', port: env.pgPort, database: 'control', user: resources.runtimeRole, password: resources.runtimePassword.toString(), max: 1 });
            try {
                await expect(central.query('SELECT 1')).rejects.toMatchObject({ code: '42501' });
            }
            finally {
                await central.end();
            }
        }
        finally {
            await runtime.end();
        }
    });
    it('fences an owned database after a checkpoint refusal and replays the same partial resources', async () => {
        const vault = join(scratch, 'partial-vault');
        await (await import('node:fs/promises')).mkdir(vault, { mode: 0o700 });
        const store = new FileSecretStore(vault), manager = new AgencyProvisioner(ddl, store, '127.0.0.1', env.pgPort);
        const args = { ...partial, assertIntent: async () => { }, assertMigrationIntent: async () => { throw new Error('INJECTED_CHECKPOINT_REFUSAL'); } };
        await expect(manager.prepare(args)).rejects.toThrow('INJECTED_CHECKPOINT_REFUSAL');
        const database = `ag_${partial.agencyId.replaceAll('-', '')}`;
        const catalog = await ddl.query('SELECT datallowconn,(SELECT count(*) FROM pg_stat_activity WHERE datname=$1) AS sessions FROM pg_database WHERE datname=$1', [database]);
        expect(catalog.rows[0]).toEqual({ datallowconn: false, sessions: '0' });
        const replay = await manager.prepare({ ...args, assertMigrationIntent: async () => { } });
        expect(replay.agencyId).toBe(partial.agencyId);
    });
    it('refuses both missing published secret files without regenerating, foreign bindings and a divergent ledger checksum', async () => {
        const fixture = extras[0]!, vault = join(scratch, 'lost-version');
        await mkdir(vault, { mode: 0o700 });
        const store = new FileSecretStore(vault), manager = new AgencyProvisioner(ddl, store, '127.0.0.1', env.pgPort);
        const input = { ...fixture, assertIntent: async () => { }, assertMigrationIntent: async () => { } };
        const resources = await manager.prepare(input), directory = join(vault, fixture.agencyId), retained = directory + '.retained';
        await rename(directory, retained);
        try {
            await expect(manager.prepare({ ...input, allowSecretCreation: false })).rejects.toThrow('SECRET_VERSION_MISSING');
            await expect(lstat(directory)).rejects.toMatchObject({ code: 'ENOENT' });
        }
        finally {
            await rename(retained, directory);
        }
        const binding = { agencyId: fixture.agencyId, operationId: fixture.operationId, secretRef: fixture.runtimeSecretRef, version: 1, kind: 'runtime' as const };
        expect((await store.read(binding)).equals(resources.runtimePassword)).toBe(true);
        await expect(store.read({ ...binding, operationId: randomUUID() })).rejects.toThrow('SECRET_BINDING_DIVERGED');
        await store.publish({ ...binding, operationId: randomUUID(), version: 2 }, resources.runtimePassword);
        await expect(store.read({ ...binding, version: 2 })).rejects.toThrow('SECRET_BINDING_DIVERGED');
        expect((await store.read(binding)).equals(resources.runtimePassword)).toBe(true);
        const pool = await manager.migrationPool(resources), client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query("UPDATE s01_migration.version SET checksum=repeat('0',64)");
            await expect(new AgencyRepository().verify(client, fixture.agencyId)).rejects.toThrow('AGENCY_CHECKSUM_CLOSED');
        }
        finally {
            await client.query('ROLLBACK');
            client.release();
            await pool.end();
        }
    });
    it('refuses a foreign-tagged homonymous role without changing its identity, password, ACL or owner', async () => {
        const fixture = extras[1]!, vault = join(scratch, 'role-conflict');
        await mkdir(vault, { mode: 0o700 });
        const store = new FileSecretStore(vault), runtime = `agr_${fixture.agencyId.replaceAll('-', '')}`;
        await bootstrap.query(`CREATE ROLE "${runtime}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD 'synthetic-foreign-role-password'`);
        await bootstrap.query(`COMMENT ON ROLE "${runtime}" IS 'foreign synthetic owner'`);
        for (const [kind, secretRef] of [['runtime', fixture.runtimeSecretRef], ['migration', fixture.migrationSecretRef]] as const)
            await store.publish({ agencyId: fixture.agencyId, operationId: fixture.operationId, secretRef, version: 1, kind }, Buffer.alloc(48, 7));
        const snapshot = async () => createHash('sha256').update(JSON.stringify((await bootstrap.query(`SELECT r.*,shobj_description(oid,'pg_authid') AS tag
   FROM pg_authid r WHERE rolname=$1`, [runtime])).rows)).digest('hex');
        const before = await snapshot();
        await expect(new AgencyProvisioner(ddl, store, '127.0.0.1', env.pgPort).prepare({ ...fixture, allowSecretCreation: false,
            assertIntent: async () => { }, assertMigrationIntent: async () => { } })).rejects.toThrow('AGENCY_ROLE_CONFLICT');
        expect(await snapshot() === before).toBe(true);
        expect((await bootstrap.query('SELECT count(*)::int AS n FROM pg_database WHERE datname=$1', ['ag_' + fixture.agencyId.replaceAll('-', '')])).rows[0].n).toBe(0);
    });
    it('refuses a homonymous database owned by another principal and preserves its catalogue and ACL', async () => {
        const fixture = extras[2]!, vault = join(scratch, 'database-conflict');
        await mkdir(vault, { mode: 0o700 });
        const database = `ag_${fixture.agencyId.replaceAll('-', '')}`;
        await bootstrap.query(`CREATE DATABASE "${database}" OWNER synthetic_bootstrap ALLOW_CONNECTIONS false`);
        await bootstrap.query(`COMMENT ON DATABASE "${database}" IS 'foreign synthetic database'`);
        const snapshot = async () => createHash('sha256').update(JSON.stringify((await bootstrap.query(`SELECT oid::text,datdba::text,
   datallowconn,datacl::text,shobj_description(oid,'pg_database') AS tag FROM pg_database WHERE datname=$1`, [database])).rows)).digest('hex');
        const before = await snapshot();
        await expect(new AgencyProvisioner(ddl, new FileSecretStore(vault), '127.0.0.1', env.pgPort).prepare({ ...fixture,
            assertIntent: async () => { }, assertMigrationIntent: async () => { } })).rejects.toThrow('AGENCY_DATABASE_CONFLICT');
        expect(await snapshot() === before).toBe(true);
    });
});
