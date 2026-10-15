import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const { Pool } = createRequire(new URL('../packages/adapters/package.json', import.meta.url))('pg');
import { assertT05Capabilities, grantT05Capabilities } from '../packages/adapters/dist/postgres/t05-capabilities.js';

if (process.argv.length !== 3 || !['--check', '--apply'].includes(process.argv[2])) {
  throw new Error('USAGE_T05_CAPABILITIES_CHECK_OR_APPLY');
}
const identity = spawnSync('python3', ['scripts/s01-worktree-identity-check.py', process.cwd()], { stdio: 'ignore' });
if (identity.status !== 0) throw new Error('WORKTREE_IDENTITY_REFUSED');
const environment = JSON.parse(await readFile('.local/environment.json', 'utf8'));
const pool = new Pool({ host: '127.0.0.1', port: environment.pgPort, database: 'control',
  user: 'control_migrator', password: (await readFile(`${environment.private}/pg/control_migrator`, 'utf8')).trim(),
  max: 1, connectionTimeoutMillis: 2000, statement_timeout: 5000 });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  if (process.argv[2] === '--apply') await grantT05Capabilities(client);
  await assertT05Capabilities(client);
  await client.query('COMMIT');
  console.log('Synthetic T05 role, membership and object ACL verified.');
} catch {
  await client.query('ROLLBACK');
  process.exitCode = 1;
  console.error('T05_CAPABILITIES_CLOSED');
} finally {
  client.release();
  await pool.end();
}
