import { readFile, readdir, mkdir, open, lstat } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { environment, inspectPartition } from './s01-fixture-manifests.mjs';
import { inspectEffects } from './s01-t06-inspect.mjs';
import { AuthorityJournal } from '../packages/adapters/dist/journal/authority-journal.js';
const require = createRequire(new URL('../packages/adapters/package.json', import.meta.url));
const { Pool } = require('pg');
if (Number(process.versions.node.split('.')[0]) !== 24)
    throw new Error('S01_PINNED_NODE_REQUIRED');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const executionId = process.argv[2], confirm = process.argv[3] === '--confirm-synthetic';
if (!uuid.test(executionId ?? '') || process.argv.length > (confirm ? 4 : 3))
    throw new Error('RECONCILE_USAGE');
execFileSync('python3', ['scripts/s01-worktree-identity-check.py', process.cwd()], { stdio: 'ignore' });
const e = await environment();
const options = { host: '127.0.0.1', port: e.pgPort, max: 1, connectionTimeoutMillis: 2000, statement_timeout: 5000, query_timeout: 7000 };
const pool = new Pool({ ...options, database: 'control', user: 'control_migrator',
    password: (await readFile(e.private + '/pg/control_migrator', 'utf8')).trim() });
const admin = new Pool({ ...options, database: 'postgres', user: 'synthetic_bootstrap',
    password: (await readFile(e.private + '/pg/bootstrap', 'utf8')).trim() });
const docker = args => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 }).trim();
const compose = ['compose', '--profile', 't06', '--env-file', '.local/compose.env', '-f', 'infra/local/compose.yaml'];
async function stoppedEvidence(ex, container) {
    const path = `.local/t06-fencing/stop-${ex.execution_id}.json`, stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o400 || stat.uid !== process.getuid())
        throw new Error('RECONCILE_STOP_PROOF_REFUSED');
    const proof = JSON.parse(await readFile(path, 'utf8'));
    if (proof.version !== 1 || proof.syntheticOnly !== true || proof.root !== e.root || proof.executionId !== ex.execution_id || proof.operationId !== ex.operation_id
        || proof.containerId !== container.Id || proof.instanceId !== ex.instance_id || !proof.allAbsent)
        throw new Error('RECONCILE_STOP_PROOF_DIVERGED');
    const startedAt = proof.startedAt ?? proof.namespace?.find(c => c.id === container.Id)?.state?.StartedAt;
    if (startedAt !== container.State.StartedAt)
        throw new Error('RECONCILE_STOP_PROOF_RESTARTED');
    if (proof.traceHash) {
        const traceStat = await lstat(`.local/t06-fencing/trace-${ex.execution_id}.json`);
        if (!traceStat.isFile() || traceStat.isSymbolicLink() || (traceStat.mode & 0o777) !== 0o400 || traceStat.uid !== process.getuid())
            throw new Error('RECONCILE_STOP_TRACE_REFUSED');
        const bytes = await readFile(`.local/t06-fencing/trace-${ex.execution_id}.json`);
        if (createHash('sha256').update(bytes).digest('hex') !== proof.traceHash)
            throw new Error('RECONCILE_STOP_TRACE_DIVERGED');
        const ids = docker(['ps', '-aq']).split('\n').filter(Boolean);
        const all = JSON.parse(docker(['inspect', ...ids]));
        const sensitive = ['/pg/provisioner', '/pg/provisioner_ddl', '/t06-migration', '/t06-provisioner-tls'].map(p => e.private + p);
        const overlap = (a, b) => a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
        const capable = all.filter(c => c.Mounts.some(m => sensitive.some(s => overlap(m.Source, s))));
        if (capable.length !== 1 || capable[0].Id !== container.Id || capable[0].State.Running || capable[0].State.Pid !== 0)
            throw new Error('RECONCILE_PRIVILEGED_NAMESPACE_ALIVE');
    }
    return { ...proof, stopProofHash: createHash('sha256').update(await readFile(path)).digest('hex') };
}
async function persistStop(ex, stopped) {
    await mkdir('.local/t06-fencing', { mode: 0o700, recursive: true });
    try {
        const file = await open(`.local/t06-fencing/stop-${ex.execution_id}.json`, 'wx', 0o400);
        try {
            await file.writeFile(JSON.stringify({ ...stopped, version: 1, syntheticOnly: true, root: e.root, executionId: ex.execution_id,
                operationId: ex.operation_id, at: new Date().toISOString() }));
            await file.sync();
        }
        finally { await file.close(); }
        const directory = await open('.local/t06-fencing', 'r');
        try { await directory.sync(); } finally { await directory.close(); }
    }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
}
async function containerFence(ex) {
    docker([...compose, 'stop', 't06-orchestrator']);
    const name = e.project + '-t06-provisioner-1';
    const before = JSON.parse(docker(['inspect', name]))[0];
    if (before.Config.Labels['com.docker.compose.project'] !== e.project
        || before.HostConfig.Privileged || before.HostConfig.PidMode === 'host')
        throw new Error('RECONCILE_NAMESPACE_REFUSED');
    // A failed readback must resume from durable host fencing evidence, never
    // restart the emitter to reconstruct a tmpfs instance identity.
    const identity = before.State.Running
        ? JSON.parse(docker(['exec', name, 'cat', '/tmp/t06-instance.json']))
        : await stoppedEvidence(ex, before);
    if (identity.instanceId !== ex.instance_id)
        throw new Error('RECONCILE_INSTANCE_MISMATCH');
    const pids = before.State.Running
        ? docker(['top', name, '-eo', 'pid']).split('\n').slice(1).map(p => Number(p.trim())) : [];
    const starts = [];
    for (const pid of pids) {
        const stat = await readFile(`/proc/${pid}/stat`, 'utf8');
        starts.push({ pid, start: stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19] });
    }
    docker([...compose, 'stop', 't06-provisioner']);
    const after = JSON.parse(docker(['inspect', name]))[0];
    if (after.Id !== before.Id || after.State.Running || after.State.Pid !== 0)
        throw new Error('RECONCILE_INSTANCE_ALIVE');
    for (const { pid, start } of starts) {
        try {
            const stat = await readFile(`/proc/${pid}/stat`, 'utf8');
            if (stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19] === start)
                throw new Error('RECONCILE_DESCENDANT_ALIVE');
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                throw error;
        }
    }
    for (const pid of await readdir('/proc'))
        if (/^\d+$/.test(pid)) {
            try {
                if ((await readFile(`/proc/${pid}/cgroup`, 'utf8')).includes(before.Id))
                    throw new Error('RECONCILE_CGROUP_ALIVE');
            }
            catch (error) {
                if (!['ENOENT', 'EACCES', 'ESRCH'].includes(error.code))
                    throw error;
            }
        }
    return { containerId: before.Id, instanceId: ex.instance_id, startedAt: before.State.StartedAt,
        processes: starts, allAbsent: true, ...(identity.stopProofHash ? { priorStopProofHash: identity.stopProofHash } : {}) };
}
const client = await pool.connect();
try {
    const partition = await inspectPartition(client, true);
    const ex = (await client.query(`SELECT e.*,o.agency_id,a.invitation_root_id FROM control.provisioning_execution e
  JOIN control.provisioning_operation o ON o.id=e.operation_id JOIN control.agency a ON a.id=o.agency_id
  WHERE e.execution_id=$1`, [executionId])).rows[0];
    const provisioningFixtures = [...partition.t06, ...partition.t07];
    if (!ex || !['RUNNING', 'BLOCKED'].includes(ex.state) || !provisioningFixtures.some(t => t.operationId === ex.operation_id
        && t.agencyId === ex.agency_id && t.rootId === ex.invitation_root_id))
        throw new Error('RECONCILE_SCOPE_REFUSED');
    if (!confirm)
        console.log(JSON.stringify({ syntheticOnly: true, inspection: true, executionState: ex.state,
            registeredBackends: ex.backends.length, confirmationRequired: true }));
    else {
        const stopped = await containerFence(ex);
        // Persist the exact instance/container binding before any readback can refuse.
        await persistStop(ex, stopped);
        const final = (await client.query('SELECT * FROM control.provisioning_execution WHERE execution_id=$1', [executionId])).rows[0];
        if (!final || final.instance_id !== ex.instance_id || final.operation_id !== ex.operation_id
            || !['RUNNING', 'BLOCKED'].includes(final.state))
            throw new Error('RECONCILE_EXECUTION_DIVERGED');
        ex.backends = final.backends;
        for (const b of ex.backends) {
            if (b.execution_id !== executionId || !Number.isInteger(b.pid) || !['ddl', 'migration'].includes(b.kind))
                throw new Error('RECONCILE_BACKEND_PROOF_REFUSED');
            const live = (await admin.query('SELECT backend_start::text,application_name FROM pg_stat_activity WHERE pid=$1', [b.pid])).rows[0];
            if (!live)
                continue;
            if (live.backend_start !== b.backend_start || live.application_name !== `t06:${executionId}:${b.kind}`)
                throw new Error('RECONCILE_BACKEND_IDENTITY_MISMATCH');
            await admin.query('SELECT pg_terminate_backend($1,5000)', [b.pid]);
            if ((await admin.query('SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND backend_start::text=$2', [b.pid, b.backend_start])).rowCount)
                throw new Error('RECONCILE_BACKEND_STILL_ALIVE');
        }
        await client.query("SELECT pg_advisory_lock(hashtextextended('s01.t06.singleton',0))");
        await client.query("SELECT pg_advisory_lock(hashtextextended('s01.t06.operation:'||$1,0))", [ex.operation_id]);
        await client.query('BEGIN');
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [ex.invitation_root_id]);
        const invitation = (await client.query('SELECT * FROM control.agency_invitation WHERE root_id=$1 FOR SHARE', [ex.invitation_root_id])).rows[0];
        const authority = (await client.query('SELECT * FROM identity.account_authority WHERE subject_id=$1 FOR SHARE', [invitation.subject_id])).rows[0];
        const member = (await client.query('SELECT * FROM identity.membership WHERE agency_id=$1 AND subject_id=$2 FOR SHARE', [ex.agency_id, invitation.subject_id])).rows[0];
        const agency = (await client.query('SELECT * FROM control.agency WHERE id=$1 FOR UPDATE', [ex.agency_id])).rows[0];
        const op = (await client.query('SELECT * FROM control.provisioning_operation WHERE id=$1 FOR UPDATE', [ex.operation_id])).rows[0];
        const gate = (await client.query('SELECT execution_id,state FROM control.provisioning_gate FOR UPDATE')).rows[0];
        const head = await new AuthorityJournal('.local/journal/application').head(invitation.subject_id);
        if (invitation.status !== 'CLAIMED' || invitation.identity_status !== 'CONFIRMED' || authority.status !== 'CONFIRMED'
            || authority.confirmed_epoch !== authority.identity_epoch || !head || head.state !== 'CONFIRMED'
            || head.hash !== authority.journal_hash || head.sequence.toString() !== authority.journal_sequence
            || head.epoch.toString() !== authority.identity_epoch || member?.role !== 'ADMIN' || member.state !== 'PENDING'
            || !['PROVISIONING', 'FAILED'].includes(agency.state) || agency.activated_at !== null
            || op.agency_id !== ex.agency_id || gate.execution_id !== executionId || !['RUNNING', 'BLOCKED'].includes(gate.state))
            throw new Error('RECONCILE_AUTHORITY_CLOSED');
        const readbacks = await inspectEffects({ central: client, admin, environment: e, execution: ex,
            allowClosedMigratedInspection: stopped.allAbsent });
        const evidence = randomUUID(), proof = { version: 1, syntheticOnly: true, root: e.root, executionId,
            operationId: ex.operation_id, at: new Date().toISOString(), stopped, readbacks, humanSyntheticConfirmation: true };
        await mkdir('.local/t06-fencing', { mode: 0o700, recursive: true });
        const proofHash = createHash('sha256').update(JSON.stringify(proof)).digest('hex');
        for (const [suffix, bytes] of [['json', JSON.stringify(proof)], ['sha256', proofHash + '\n']]) {
            const file = await open(`.local/t06-fencing/${evidence}.${suffix}`, 'wx', 0o400);
            try {
                await file.writeFile(bytes);
                await file.sync();
            }
            finally {
                await file.close();
            }
        }
        const directory = await open('.local/t06-fencing', 'r');
        try {
            await directory.sync();
        }
        finally {
            await directory.close();
        }
        if (createHash('sha256').update(await readFile(`.local/t06-fencing/${evidence}.json`)).digest('hex')
            !== (await readFile(`.local/t06-fencing/${evidence}.sha256`, 'utf8')).trim())
            throw new Error('RECONCILE_PROOF_DIVERGED');
        await client.query("UPDATE control.provisioning_execution SET state='FENCED',closed_at=clock_timestamp(),fencing_evidence_ref=$2 WHERE execution_id=$1", [executionId, evidence]);
        await client.query("UPDATE control.provisioning_operation SET status='FAILED',last_error_code='EXECUTION_UNCERTAIN',retryable=(attempt<4),version=version+1 WHERE id=$1", [ex.operation_id]);
        await client.query("UPDATE control.agency SET state='FAILED',version=version+1 WHERE id=$1 AND state='PROVISIONING'", [ex.agency_id]);
        await client.query("INSERT INTO control.audit_event(event_id,agency_id,actor_id,actor_type,event_type,resource_id,outcome,correlation,resource_version) VALUES($1,$2,'00000000-0000-4000-8000-000000000074','service','agency.provisioning.fenced',$3,'succeeded',$3,1)", [evidence, ex.agency_id, ex.operation_id]);
        await client.query("UPDATE control.provisioning_gate SET state='IDLE',execution_id=NULL,version=version+1,updated_at=clock_timestamp() WHERE singleton=true");
        await client.query('COMMIT');
        console.log(JSON.stringify({ syntheticOnly: true, proofHash, instanceStopped: true, registeredBackendsAbsent: true,
            readbacksResolved: true, retainedResources: true, execution: 'FENCED', gate: 'IDLE', humanSyntheticConfirmation: true }));
    }
}
catch (error) {
    await client.query('ROLLBACK').catch(() => { });
    throw error;
}
finally {
    await client.query('SELECT pg_advisory_unlock_all()').catch(() => { });
    client.release();
    await pool.end();
    await admin.end();
}
