import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { assertT07Capabilities } from '../src/postgres/t07-capabilities.js';

const env = JSON.parse(await readFile('.local/environment.json', 'utf8')) as {
  root: string; private: string; pgPort: number; syntheticOnly: boolean;
};
if (!env.syntheticOnly || env.root !== process.cwd()) throw new Error('SYNTHETIC_REQUIRED');
const pool = async (role: 'control_migrator' | 'control_coordinator' | 'control_api' | 'provisioner') => new Pool({
  host: '127.0.0.1', port: env.pgPort, database: 'control', user: role,
  password: (await readFile(`${env.private}/pg/${role}`, 'utf8')).trim(), max: 1,
});
const migrator = await pool('control_migrator');
const coordinator = await pool('control_coordinator');
const api = await pool('control_api');
const provisioner = await pool('provisioner');
afterAll(async () => { await migrator.end(); await coordinator.end(); await api.end(); await provisioner.end(); });

describe('T07 real PostgreSQL capability boundary', () => {
  it('asserts exact non-login role membership and column/function ACLs', async () => {
    const c = await migrator.connect();
    try { await assertT07Capabilities(c); }
    finally { c.release(); }
  });
  it('allows only the coordinator to SET the narrow role, without DDL, cross-tenant writes, or audit mutation', async () => {
    const c = await coordinator.connect();
    try {
      await c.query('BEGIN');
      await c.query('SET LOCAL ROLE control_t07');
      await expect(c.query('SELECT id,invitation_root_id,state,version FROM control.agency LIMIT 0')).resolves.toBeDefined();
      await c.query('ROLLBACK');
      for (const sql of [
        'UPDATE identity.account_authority SET status=status WHERE false',
        'UPDATE identity.session SET revoked_at=revoked_at WHERE false',
        'UPDATE control.agency SET name=name WHERE false',
        'DELETE FROM control.audit_event WHERE false',
        'CREATE TABLE control.t07_forbidden(id integer)',
      ]) {
        await c.query('BEGIN');
        await c.query('SET LOCAL ROLE control_t07');
        await expect(c.query(sql)).rejects.toMatchObject({ code: '42501' });
        await c.query('ROLLBACK');
      }
    } finally { c.release(); }
  });
  it('denies the migration capability to the API and confines the reader to reserved evidence', async () => {
    const apiClient = await api.connect();
    try {
      await apiClient.query('BEGIN');
      await expect(apiClient.query('SET LOCAL ROLE control_t07')).rejects.toMatchObject({ code: '42501' });
      await apiClient.query('ROLLBACK');
    } finally { apiClient.release(); }
    const reader = await provisioner.connect();
    try {
      await reader.query('BEGIN');
      await reader.query('SET LOCAL ROLE control_t07_local_reader');
      await expect(reader.query('SELECT event_id,type,agency_id,resource_id,version,status FROM control.outbox LIMIT 0')).resolves.toBeDefined();
      await expect(reader.query('SELECT * FROM control.audit_event LIMIT 0')).rejects.toMatchObject({ code: '42501' });
      await reader.query('ROLLBACK');
    } finally { reader.release(); }
  });
});
