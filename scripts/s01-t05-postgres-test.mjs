// Real PostgreSQL capability checks. All fixture writes are rolled back.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const { Pool } = createRequire(new URL('../packages/adapters/package.json', import.meta.url))('pg');
import { assertT05Capabilities } from '../packages/adapters/dist/postgres/t05-capabilities.js';

if (spawnSync('python3', ['scripts/s01-worktree-identity-check.py', process.cwd()], { stdio: 'ignore' }).status !== 0) {
  throw new Error('WORKTREE_IDENTITY_REFUSED');
}
const environment = JSON.parse(await readFile('.local/environment.json', 'utf8'));
const pools = [];
let cases = 0;
async function connect(role) {
  const pool = new Pool({ host: '127.0.0.1', port: environment.pgPort, database: 'control',
    user: role, password: (await readFile(`${environment.private}/pg/${role}`, 'utf8')).trim(),
    max: 1, connectionTimeoutMillis: 2000, statement_timeout: 5000 });
  pools.push(pool);
  return pool.connect();
}
async function denied(client, sql, parameters = []) {
  await client.query('SAVEPOINT forbidden_action');
  let code;
  try { await client.query(sql, parameters); } catch (error) { code = error.code; }
  await client.query('ROLLBACK TO SAVEPOINT forbidden_action');
  assert.equal(code, '42501', 'Expected PostgreSQL insufficient_privilege');
  cases++;
}
const migrator = await connect('control_migrator');
const coordinator = await connect('control_coordinator');
const runtime = await connect('control_api');
try {
  await assertT05Capabilities(migrator); cases++;
  await coordinator.query('BEGIN');
  await runtime.query('BEGIN');
  await denied(runtime, 'SET LOCAL ROLE control_t05');
  await denied(runtime, 'SET LOCAL ROLE control_coordinator');
  await denied(runtime, 'INSERT INTO identity.account_authority(subject_id) VALUES($1)', [randomUUID()]);
  const subject = randomUUID(), root = randomUUID(), invitation = randomUUID(), agency = randomUUID();
  await coordinator.query('INSERT INTO identity.account_authority(subject_id) VALUES($1)', [subject]);
  await coordinator.query('SET LOCAL ROLE control_t05');
  assert.equal((await coordinator.query('SELECT current_user')).rows[0].current_user, 'control_t05'); cases++;
  await denied(coordinator, 'SET LOCAL ROLE control_migrator');
  await denied(coordinator, 'CREATE TABLE control.t05_forbidden_test(id integer)');
  await denied(coordinator, 'SELECT * FROM identity.account_authority');
  await denied(coordinator, 'INSERT INTO identity.account_authority(subject_id) VALUES($1)', [randomUUID()]);
  await denied(coordinator, 'UPDATE identity.session SET revoked_at=now()');
  await denied(coordinator, 'INSERT INTO control.audit_event(event_id) VALUES($1)', [randomUUID()]);
  await denied(coordinator, 'INSERT INTO control.outbox(event_id) VALUES($1)', [randomUUID()]);
  await denied(coordinator, 'SELECT * FROM control.database_locator');
  await denied(coordinator, 'INSERT INTO control.database_locator(agency_id) VALUES($1)', [agency]);
  await coordinator.query(`INSERT INTO control.agency_invitation(id,root_id,subject_id,contact,owner_id,recovery_channel_ref)
    VALUES($1,$2,$3,'synthetic-capabilities@example.invalid',$4,'synthetic-fixture')`,
  [invitation, root, subject, '00000000-0000-4000-8000-000000000001']);
  const invited = (await coordinator.query('SELECT status,identity_status,version FROM control.agency_invitation WHERE id=$1 FOR UPDATE', [invitation])).rows[0];
  assert.deepEqual(invited, { status: 'PENDING_IDENTITY', identity_status: 'PENDING', version: '1' }); cases++;
  for (const column of ['identity_status', 'owner_id', 'subject_id', 'contact', 'root_id']) {
    await denied(coordinator, `UPDATE control.agency_invitation SET ${column}=${column} WHERE id=$1`, [invitation]);
  }
  await denied(coordinator, `INSERT INTO control.agency_invitation(id,root_id,subject_id,contact,owner_id,status)
    VALUES($1,$2,$3,'synthetic@example.invalid',$3,'ISSUED')`, [randomUUID(), randomUUID(), subject]);
  await coordinator.query(`UPDATE control.agency_invitation SET token_hash=$2,expires_at=now()+interval '10min',status='ISSUED',version=version+1 WHERE id=$1`, [invitation, '1'.repeat(64)]);
  assert.equal((await coordinator.query('SELECT status FROM control.agency_invitation WHERE id=$1', [invitation])).rows[0].status, 'ISSUED'); cases++;
  await coordinator.query('INSERT INTO control.agency(id,invitation_root_id,name,canonical_name_hash) VALUES($1,$2,$3,$4)',
    [agency, root, 'Synthetic capabilities', '2'.repeat(64)]);
  const agencyRow = (await coordinator.query('SELECT state,version,activated_at FROM control.agency WHERE id=$1', [agency])).rows[0];
  assert.deepEqual(agencyRow, { state: 'PROVISIONING', version: '1', activated_at: null }); cases++;
  await denied(coordinator, `INSERT INTO control.agency(id,invitation_root_id,name,canonical_name_hash,state)
    VALUES($1,$2,'Forbidden',$3,'ACTIVE')`, [randomUUID(), root, '3'.repeat(64)]);
  await denied(coordinator, `UPDATE control.agency SET state='ACTIVE' WHERE id=$1`, [agency]);
  await coordinator.query(`INSERT INTO identity.membership(subject_id,agency_id,role) VALUES($1,$2,'ADMIN')`, [subject, agency]);
  assert.equal((await coordinator.query('SELECT state FROM identity.membership WHERE agency_id=$1', [agency])).rows[0].state, 'PENDING'); cases++;
  await denied(coordinator, `INSERT INTO identity.membership(subject_id,agency_id,role,state) VALUES($1,$2,'ADMIN','ACTIVE')`, [subject, agency]);
  await denied(coordinator, `UPDATE identity.membership SET state='ACTIVE' WHERE agency_id=$1`, [agency]);
  const operation = randomUUID();
  await coordinator.query('INSERT INTO control.provisioning_operation(id,agency_id) VALUES($1,$2)', [operation, agency]);
  assert.deepEqual((await coordinator.query('SELECT step,status,attempt FROM control.provisioning_operation WHERE id=$1', [operation])).rows[0],
    { step: 'ACCEPTED', status: 'PENDING', attempt: 0 }); cases++;
  await denied(coordinator, `INSERT INTO control.provisioning_operation(id,agency_id,step) VALUES($1,$2,'ACTIVE')`, [randomUUID(), agency]);
  await denied(coordinator, `UPDATE control.provisioning_operation SET status='SUCCEEDED' WHERE id=$1`, [operation]);
  await coordinator.query(`INSERT INTO control.idempotency_record(actor_id,operation_type,key,canonical_body_hash,resource_id,result)
    VALUES($1,'synthetic.capabilities-test',$2,$3,$4,'{}')`, [subject, randomUUID(), '4'.repeat(64), root]);
  cases++;
  await denied(coordinator, 'UPDATE control.idempotency_record SET result=result WHERE actor_id=$1', [subject]);
  for (const table of ['control.agency_invitation', 'control.agency', 'identity.membership', 'control.provisioning_operation', 'control.idempotency_record']) {
    await denied(coordinator, `DELETE FROM ${table} WHERE false`);
  }
  await coordinator.query('SET LOCAL ROLE control_audit');
  assert.equal((await coordinator.query('SELECT current_user')).rows[0].current_user, 'control_audit'); cases++;
  await coordinator.query('SET LOCAL ROLE control_t05');
  assert.equal((await coordinator.query('SELECT current_user')).rows[0].current_user, 'control_t05'); cases++;
  await coordinator.query('ROLLBACK');
  await runtime.query('ROLLBACK');
  assert.equal((await migrator.query('SELECT count(*)::int AS n FROM control.agency_invitation WHERE id=$1', [invitation])).rows[0].n, 0); cases++;
  console.log(JSON.stringify({ realPostgresCapabilityCasesPassed: cases, allFixturesRolledBack: true,
    auditWriterRestoration: 'deferred-plan-step-3', businessRuntimeTested: false }));
} catch (error) {
  await coordinator.query('ROLLBACK'); await runtime.query('ROLLBACK');
  console.error(JSON.stringify({ status: 'FAIL', completedCases: cases, code: error.code ?? 'ASSERTION_OR_CAPABILITY_FAILURE' }));
  process.exitCode = 1;
} finally {
  migrator.release(); coordinator.release(); runtime.release();
  await Promise.all(pools.map(pool => pool.end()));
}
