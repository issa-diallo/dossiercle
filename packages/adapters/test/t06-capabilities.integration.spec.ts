import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, describe, it, expect } from 'vitest';
import { assertControlProvisioningSchema } from '../src/postgres/migrate.js';
const env = JSON.parse(await readFile('.local/environment.json', 'utf8')) as {
    root: string;
    private: string;
    pgPort: number;
    syntheticOnly: boolean;
};
if (!env.syntheticOnly || env.root !== process.cwd())
    throw new Error('SYNTHETIC_REQUIRED');
const pool = async (role: 'control_migrator' | 'provisioner') => new Pool({ host: '127.0.0.1', port: env.pgPort, database: 'control', user: role, password: (await readFile(`${env.private}/pg/${role}`, 'utf8')).trim(), max: 1 });
const migrator = await pool('control_migrator'), provisioner = await pool('provisioner');
afterAll(async () => { await migrator.end(); await provisioner.end(); });
describe('T06 real PostgreSQL privilege boundary', () => {
    it('requires the current additive schema before coordinator startup', async () => {
        const c = await migrator.connect();
        try {
            await assertControlProvisioningSchema(c);
        }
        finally {
            c.release();
        }
    });
    it('allows only the central provisioner to enter control_t06 and denies identity, activation and DDL writes', async () => {
        const c = await provisioner.connect();
        try {
            await expect(c.query('SELECT id FROM control.agency LIMIT 0')).rejects.toMatchObject({ code: '42501' });
            await c.query('BEGIN');
            await c.query('SET LOCAL ROLE control_t06');
            expect((await c.query('SELECT count(*)::int AS n FROM control.provisioning_gate')).rows[0].n).toBe(1);
            await c.query('ROLLBACK');
            for (const sql of ['UPDATE identity.account_authority SET status=status WHERE false', 'UPDATE identity.membership SET state=state WHERE false', 'UPDATE control.agency SET activated_at=activated_at WHERE false', 'CREATE TABLE control.t06_forbidden(id integer)']) {
                await c.query('BEGIN');
                await c.query('SET LOCAL ROLE control_t06');
                await expect(c.query(sql)).rejects.toMatchObject({ code: '42501' });
                await c.query('ROLLBACK');
            }
        }
        finally {
            c.release();
        }
    });
    it('exposes the tuple-lock SECURITY DEFINER only through the NOLOGIN capability role', async () => {
        await expect(provisioner.query("SELECT * FROM control.lock_provisioning_scope('11111111-1111-4111-8111-111111111111')")).rejects.toMatchObject({ code: '42501' });
        const c = await provisioner.connect();
        try {
            await c.query('BEGIN');
            await c.query('SET LOCAL ROLE control_t06');
            await expect(c.query("SELECT * FROM control.lock_provisioning_scope('11111111-1111-4111-8111-111111111111')")).rejects.toMatchObject({ code: 'P0002' });
            await c.query('ROLLBACK');
        }
        finally {
            c.release();
        }
    });
    it('keeps the DDL credential out of the central control database', async () => {
        const ddl = new Pool({ host: '127.0.0.1', port: env.pgPort, database: 'control', user: 'provisioner_ddl', password: (await readFile(`${env.private}/pg/provisioner_ddl`, 'utf8')).trim(), max: 1 });
        await expect(ddl.query('SELECT 1')).rejects.toMatchObject({ code: '42501' });
        await ddl.end();
    });
});
