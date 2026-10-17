/** Private host recovery of an exhausted delivery budget. Never executes provisioning. */
import { readFile, open, mkdir } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { environment, inspectPartition } from './s01-fixture-manifests.mjs';
import { AuthorityJournal } from '../packages/adapters/dist/journal/authority-journal.js';
import { inspectEffects } from './s01-t06-inspect.mjs';
const require = createRequire(new URL('../packages/adapters/package.json', import.meta.url));
const { Pool } = require('pg');
const operationId = process.argv[2], confirm = process.argv[3] === '--confirm-synthetic';
if (!/^[0-9a-f-]{36}$/.test(operationId ?? '') || process.argv.length > (confirm ? 4 : 3))
    throw new Error('RESUME_USAGE');
execFileSync('python3', ['scripts/s01-worktree-identity-check.py', process.cwd()], { stdio: 'ignore' });
const e = await environment(), base = { host: '127.0.0.1', port: e.pgPort, max: 1, connectionTimeoutMillis: 2000, statement_timeout: 5000, query_timeout: 7000 };
const pool = new Pool({ ...base, database: 'control', user: 'control_migrator', password: (await readFile(e.private + '/pg/control_migrator', 'utf8')).trim() });
const admin = new Pool({ ...base, database: 'postgres', user: 'synthetic_bootstrap', password: (await readFile(e.private + '/pg/bootstrap', 'utf8')).trim() });
const c = await pool.connect();
try {
    const partition = await inspectPartition(c, true), tuple = partition.t06.find(t => t.operationId === operationId);
    if (!tuple)
        throw new Error('RESUME_SCOPE_REFUSED');
    if (confirm)
        execFileSync('docker', ['compose', '--profile', 't06', '--env-file', '.local/compose.env', '-f', 'infra/local/compose.yaml', 'stop', 't06-orchestrator'], { stdio: 'ignore', timeout: 30000 });
    await c.query("SELECT pg_advisory_lock(hashtextextended('s01.t06.singleton',0))");
    await c.query("SELECT pg_advisory_lock(hashtextextended('s01.t06.operation:'||$1,0))", [operationId]);
    await c.query('BEGIN');
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [tuple.rootId]);
    const invitation = (await c.query('SELECT * FROM control.agency_invitation WHERE root_id=$1 FOR SHARE', [tuple.rootId])).rows[0];
    const authority = (await c.query('SELECT * FROM identity.account_authority WHERE subject_id=$1 FOR SHARE', [tuple.subjectId])).rows[0];
    const member = (await c.query('SELECT * FROM identity.membership WHERE subject_id=$1 AND agency_id=$2 FOR SHARE', [tuple.subjectId, tuple.agencyId])).rows[0];
    const agency = (await c.query('SELECT * FROM control.agency WHERE id=$1 FOR UPDATE', [tuple.agencyId])).rows[0];
    const op = (await c.query('SELECT * FROM control.provisioning_operation WHERE id=$1 FOR UPDATE', [operationId])).rows[0];
    const gate = (await c.query('SELECT * FROM control.provisioning_gate FOR UPDATE')).rows[0];
    const head = await new AuthorityJournal('.local/journal/application').head(tuple.subjectId);
    if (invitation.subject_id !== tuple.subjectId || invitation.status !== 'CLAIMED' || invitation.identity_status !== 'CONFIRMED'
        || authority.status !== 'CONFIRMED' || authority.confirmed_epoch !== authority.identity_epoch
        || head?.state !== 'CONFIRMED' || head.hash !== authority.journal_hash || head.epoch.toString() !== authority.identity_epoch
        || head.sequence.toString() !== authority.journal_sequence || member?.role !== 'ADMIN' || member.state !== 'PENDING'
        || agency.invitation_root_id !== tuple.rootId || !['PROVISIONING', 'FAILED'].includes(agency.state)
        || agency.activated_at !== null || op.agency_id !== tuple.agencyId || op.attempt >= 4
        || !(op.status === 'PENDING' || (op.status === 'FAILED' && op.retryable)) || gate.state !== 'IDLE' || gate.execution_id !== null)
        throw new Error('RESUME_AUTHORITY_CLOSED');
    if ((await c.query("SELECT 1 FROM control.provisioning_execution WHERE state IN ('RUNNING','BLOCKED') LIMIT 1")).rowCount)
        throw new Error('RESUME_EXECUTION_UNCERTAIN');
    const rounds = (await c.query(`SELECT w.delivery_round,o.status,w.created_at<clock_timestamp()-interval '30 seconds' AS old
  FROM control.provisioning_wakeup w JOIN control.outbox o USING(event_id)
  WHERE operation_id=$1 AND expected_operation_version=$2 AND target_attempt=$3`, [operationId, op.version, op.attempt + 1])).rows;
    if (rounds.length !== 3 || rounds.some(r => r.status !== 'DELIVERED' || !r.old))
        throw new Error('RESUME_BUDGET_NOT_EXHAUSTED');
    const readbacks = await inspectEffects({ central: c, admin, environment: e,
        execution: { operation_id: operationId, agency_id: tuple.agencyId } });
    if (!confirm) {
        console.log(JSON.stringify({ syntheticOnly: true, inspection: true, exhaustedRounds: 3,
            readbacksResolved: true, confirmationRequired: true }));
        await c.query('ROLLBACK');
    }
    else {
        const id = randomUUID(), proof = JSON.stringify({ syntheticOnly: true, root: e.root, operationId,
            expectedVersion: op.version, newVersion: (BigInt(op.version) + 1n).toString(), readbacks, at: new Date().toISOString(), humanSyntheticConfirmation: true });
        await mkdir('.local/t06-delivery-recovery', { mode: 0o700, recursive: true });
        for (const [suffix, data] of [['json', proof], ['sha256', createHash('sha256').update(proof).digest('hex') + '\n']]) {
            const file = await open(`.local/t06-delivery-recovery/${id}.${suffix}`, 'wx', 0o400);
            try {
                await file.writeFile(data);
                await file.sync();
            }
            finally {
                await file.close();
            }
        }
        const directory = await open('.local/t06-delivery-recovery', 'r');
        try {
            await directory.sync();
        }
        finally {
            await directory.close();
        }
        await c.query('UPDATE control.provisioning_operation SET version=version+1 WHERE id=$1', [operationId]);
        await c.query(`INSERT INTO control.audit_event(event_id,agency_id,actor_id,actor_type,event_type,
   resource_id,outcome,correlation,resource_version) VALUES($1,$2,'00000000-0000-4000-8000-000000000074',
   'service','agency.provisioning.wakeup-resumed',$3,'accepted',$3,$4)`, [id, tuple.agencyId, operationId, (BigInt(op.version) + 1n).toString()]);
        await c.query('COMMIT');
        console.log(JSON.stringify({ syntheticOnly: true, newDeliveryCycleAuthorized: true,
            countersReset: false, effectsExecuted: 0, proofRef: id }));
    }
}
catch (error) {
    await c.query('ROLLBACK').catch(() => { });
    throw error;
}
finally {
    await c.query('SELECT pg_advisory_unlock_all()').catch(() => { });
    c.release();
    await pool.end();
    await admin.end();
}
