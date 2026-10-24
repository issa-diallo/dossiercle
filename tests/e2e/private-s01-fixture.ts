import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomUUID, randomBytes } from 'node:crypto';
import { readFile, writeFile, lstat, readdir, realpath, chmod, statfs, mkdir, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { Pool, type PoolClient } from '../../packages/adapters/dist/postgres/runtime-pool.js';
import { e } from '../auth/private-t05-native.js';

const run = promisify(execFile);
const readerParent = e.root + '/.local/accessibility';
const readerLedger = readerParent + '/reader-ledger';
const readerAnchor = readerParent + '/reader-ledger.created.json';
const readerUuid = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
async function readerDirectory(path: string) {
  const info = await lstat(path);
  if (!e.syntheticOnly || e.root !== process.cwd() || !info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid?.()
      || (info.mode & 0o7777) !== 0o700 || await realpath(path) !== path) throw new Error('OWNED_READER_DIRECTORY_REFUSED');
}
async function readReaderRecord(path: string) {
  const fd = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await fd.stat();
    if (!info.isFile() || info.uid !== process.getuid?.() || (info.mode & 0o7777) !== 0o400 || info.size > 1024) throw new Error('OWNED_READER_RECORD_REFUSED');
    const value = JSON.parse(await fd.readFile('utf8')) as { root?: unknown; version?: unknown; token?: unknown; kind?: unknown };
    if (!value || typeof value !== 'object' || Object.keys(value).sort().join(',') !== 'kind,root,token,version') throw new Error('OWNED_READER_RECORD_REFUSED');
    return value;
  } finally { await fd.close(); }
}
async function writeReaderRecord(path: string, token: string | null, kind: 'anchor' | 'open' | 'closed') {
  const fd = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o400);
  try { await fd.writeFile(JSON.stringify({ version: 1, root: e.root, token, kind }) + '\n'); await fd.sync(); }
  finally { await fd.close(); }
  const directory = await open(kind === 'anchor' ? readerParent : readerLedger, 'r');
  try { await directory.sync(); } finally { await directory.close(); }
}
/** Persistent across Playwright worker crashes; never treats a timeout as reader exit. */
export async function assertNoActiveReader() {
  try {
    await readerDirectory(e.root + '/.local'); await readerDirectory(readerParent);
    let names: string[];
    try { await readerDirectory(readerLedger); names = await readdir(readerLedger); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      try { await lstat(readerAnchor); } catch (absent) { if ((absent as NodeJS.ErrnoException).code === 'ENOENT') return; throw absent; }
      throw new Error('OWNED_READER_LEDGER_MISSING');
    }
    const anchor = await readReaderRecord(readerAnchor);
    if (anchor.root !== e.root || anchor.version !== 1 || anchor.token !== null || anchor.kind !== 'anchor' || names.length > 128) throw new Error('OWNED_READER_LEDGER_REFUSED');
    const opened = new Set<string>(), closed = new Set<string>();
    for (const name of names) {
      const match = new RegExp('^(' + readerUuid + ')\\.(open|closed)\\.json$').exec(name);
      if (!match) throw new Error('OWNED_READER_RECORD_REFUSED');
      const record = await readReaderRecord(join(readerLedger, name));
      if (record.root !== e.root || record.version !== 1 || record.token !== match[1] || record.kind !== match[2]) throw new Error('OWNED_READER_RECORD_REFUSED');
      (match[2] === 'open' ? opened : closed).add(match[1]!);
    }
    if (opened.size !== closed.size || [...opened].some(token => !closed.has(token))) throw new Error('OWNED_READER_EXIT_NOT_CONFIRMED');
  } catch { throw new Error('OWNED_READER_AUTH_BARRIER_REFUSED'); }
}
export async function beginOwnedReaderCapture() {
  try {
    await assertNoActiveReader();
    try { await mkdir(readerLedger, { mode: 0o700 }); await writeReaderRecord(readerAnchor, null, 'anchor'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    await readerDirectory(readerLedger);
    await assertNoActiveReader();
    const token = randomUUID();
    await writeReaderRecord(join(readerLedger, token + '.open.json'), token, 'open');
    return token;
  } catch { throw new Error('OWNED_READER_CAPTURE_OPEN_REFUSED'); }
}
/** Only the caller that has observed its own child's exit may call this function. */
export async function confirmOwnedReaderExit(token: string) {
  try {
    if (!new RegExp('^' + readerUuid + '$').test(token)) throw new Error();
    await readerDirectory(readerLedger);
    const record = await readReaderRecord(join(readerLedger, token + '.open.json'));
    if (record.root !== e.root || record.version !== 1 || record.token !== token || record.kind !== 'open') throw new Error();
    await writeReaderRecord(join(readerLedger, token + '.closed.json'), token, 'closed');
  } catch { throw new Error('OWNED_READER_CAPTURE_CLOSE_REFUSED'); }
}
const operation = `import {fixturePool,declareT06Scope,declareT07Scope,captureDefault,inspectPartition} from './scripts/s01-fixture-manifests.mjs';
const pool=await fixturePool();try{let result;if(process.argv[1]==='declare'){await declareT06Scope(pool,JSON.parse(process.argv[2]));result=await inspectPartition(pool)}else if(process.argv[1]==='declare-t07'){await declareT07Scope(pool,JSON.parse(process.argv[2]));result=await inspectPartition(pool)}else if(process.argv[1]==='failed'){const {agencyId,operationId}=JSON.parse(process.argv[2]);await pool.query('BEGIN');try{const candidate=(await pool.query(\"SELECT invitation_root_id::text AS root_id FROM control.agency WHERE id=$1\",[agencyId])).rows[0];if(!candidate)throw new Error('FAILED_FIXTURE_STATE_INVALID');await pool.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))',[candidate.root_id]);const current=(await pool.query(\"SELECT a.state AS agency_state,a.version AS agency_version,a.activated_at,o.status AS operation_status,o.version AS operation_version,g.state AS gate_state,g.execution_id,(SELECT count(*)::int FROM control.provisioning_execution e WHERE e.operation_id=o.id AND e.state IN ('RUNNING','BLOCKED')) AS active_executions FROM control.agency a JOIN control.provisioning_operation o ON o.agency_id=a.id CROSS JOIN control.provisioning_gate g WHERE a.id=$1 AND o.id=$2 AND g.singleton=true FOR UPDATE OF a,o\",[agencyId,operationId])).rows[0];if(!current||current.agency_state!=='READY'||current.activated_at!==null||current.operation_status!=='SUCCEEDED'||current.gate_state!=='IDLE'||current.execution_id!==null||current.active_executions!==0)throw new Error('FAILED_FIXTURE_STATE_INVALID');const a=await pool.query(\"UPDATE control.agency SET state='FAILED',version=version+1 WHERE id=$1 AND state='READY' AND activated_at IS NULL AND version=$2 RETURNING id\",[agencyId,current.agency_version]);const o=await pool.query(\"UPDATE control.provisioning_operation SET step='SECRETS_REFERENCED',status='FAILED',retryable=false,last_error_code='DEPENDENCY_UNAVAILABLE',version=version+1 WHERE id=$1 AND agency_id=$2 AND status='SUCCEEDED' AND version=$3 RETURNING id\",[operationId,agencyId,current.operation_version]);if(a.rowCount!==1||o.rowCount!==1)throw new Error('FAILED_FIXTURE_STATE_INVALID');await pool.query('COMMIT')}catch(error){await pool.query('ROLLBACK');throw error}result=await inspectPartition(pool)}else result=await captureDefault(pool);process.stdout.write(JSON.stringify({t05:result.t05.length,t06:result.t06.length,t07:result.t07.length}));}finally{await pool.end();}`;
async function manifest(action: 'declare' | 'declare-t07' | 'failed' | 'capture', scope?: { rootId: string; subjectId: string } | { agencyId: string; operationId: string }) {
  try {
    const args = ['--input-type=module', '-e', operation, action]; if (scope) args.push(JSON.stringify(scope));
    const { stdout } = await run(e.root + '/.local/node/bin/node', args, { cwd: e.root, timeout: 30_000, maxBuffer: 4096 });
    const encoded = stdout.match(/\{"t05":\d+,"t06":\d+,"t07":\d+\}/)?.[0];
    if (!encoded) throw new Error('PRIVATE_FIXTURE_MANIFEST_OUTPUT_INVALID');
    const counts = JSON.parse(encoded) as { t05: number; t06: number; t07: number };
    if (!Number.isSafeInteger(counts.t05) || !Number.isSafeInteger(counts.t06) || !Number.isSafeInteger(counts.t07)) throw new Error();
    return counts;
  } catch (cause) {
    const value = cause as { message?: unknown; code?: unknown; stderr?: unknown };
    const message = typeof value.stderr === 'string' ? value.stderr : value.message;
    const match = typeof message === 'string' ? message.match(/\b[A-Z][A-Z_0-9]{3,80}\b/) : null;
    const safe = match?.[0] && /^[A-Z][A-Z_0-9]{3,80}$/.test(match[0]) ? match[0]
      : typeof value.code === 'string' && /^[A-Z][A-Z_0-9]{0,40}$/.test(value.code) ? value.code : 'UNKNOWN';
    throw new Error('PRIVATE_FIXTURE_MANIFEST_FAILED_' + safe);
  }
}
export async function declareCreateIntent(invitation: { root: string; subject: string }, partition: 't06' | 't07' = 't06') {
  return manifest(partition === 't06' ? 'declare' : 'declare-t07', { rootId: invitation.root, subjectId: invitation.subject });
}
export async function captureCreatedAgency() { return manifest('capture'); }
export async function markAgencyFailedFixture(agencyId: string, operationId: string) { return manifest('failed', { agencyId, operationId }); }
export async function expireNativeBffSession(cookie: string) {
  const password = (await readFile(e.private + '/pg/control_migrator', 'utf8')).trim();
  const db = new Pool({ host: '127.0.0.1', port: e.pgPort, database: 'control', user: 'control_migrator', password, max: 1 });
  try {
    const hash = createHash('sha256').update(cookie).digest('hex');
    const expired = await db.query("UPDATE identity.session SET issued_at=now()-interval '31 minutes',last_human_activity_at=now()-interval '31 minutes',absolute_expires_at=now()+interval '14 days' WHERE cookie_hash=$1 AND revoked_at IS NULL", [hash]);
    if (expired.rowCount !== 1) throw new Error('NATIVE_BFF_SESSION_FIXTURE_INVALID');
  } finally { await db.end(); }
}

/** Observe the terminal fixture while the real workers remain running. */
export async function verifyFailedFixtureStability(agencyId: string, operationId: string) {
  const password = (await readFile(e.private + '/pg/control_migrator', 'utf8')).trim();
  const db = new Pool({ host: '127.0.0.1', port: e.pgPort, database: 'control', user: 'control_migrator', password, max: 1 });
  const workers = async () => {
    for (const service of ['t06-provisioner', 't06-orchestrator']) {
      const { stdout } = await run('docker', ['inspect', '--format', '{{.State.Running}} {{.RestartCount}}', e.project + '-' + service + '-1']);
      if (stdout.trim() !== 'true 0') throw new Error('FAILED_FIXTURE_WORKER_NOT_RUNNING');
    }
  };
  const snapshot = async () => {
    const row = (await db.query("SELECT a.state,a.version::text AS agency_version,o.status,o.version::text AS operation_version,o.retryable FROM control.agency a JOIN control.provisioning_operation o ON o.agency_id=a.id WHERE a.id=$1 AND o.id=$2 AND a.activated_at IS NULL", [agencyId, operationId])).rows[0];
    if (!row || row.state !== 'FAILED' || row.status !== 'FAILED' || row.retryable !== false) throw new Error('FAILED_FIXTURE_NOT_TERMINAL');
    return JSON.stringify(row);
  };
  try {
    await workers(); const before = await snapshot();
    await new Promise(resolve => setTimeout(resolve, 75_000));
    await workers();
    if (await snapshot() !== before) throw new Error('FAILED_FIXTURE_CHANGED_DURING_OBSERVATION');
  } finally { await db.end(); }
}

type RetryFixture = { agencyId: string; operationId: string };
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function retryWorkersRunning() {
  for (const service of ['t06-provisioner', 't06-orchestrator']) {
    const { stdout } = await run('docker', ['inspect', '--format', '{{.State.Running}} {{.RestartCount}}', e.project + '-' + service + '-1'], { timeout: 5000 });
    if (stdout.trim() !== 'true 0') throw new Error('RETRY_FIXTURE_WORKER_REFUSED');
  }
}
async function retryPool(role: 'control_migrator' | 'inngest', max = 1) {
  return new Pool({ host: '127.0.0.1', port: e.pgPort, database: role === 'inngest' ? 'inngest' : 'control', user: role,
    password: (await readFile(e.private + '/pg/' + role, 'utf8')).trim(), max, connectionTimeoutMillis: 5000, query_timeout: 5000 });
}
/** A real before-emission failure, followed by exhaustion of native delivery rounds.
 * No state, ledger, timestamp or worker is changed by this fixture. */
export async function qualifyRetryableFailed(create: () => Promise<RetryFixture>): Promise<RetryFixture> {
  let phase = 'IDENTITY', faultApplied = false, restorationIssue = false, connectionLost = false;
  let db: Awaited<ReturnType<typeof retryPool>> | undefined, history: Awaited<ReturnType<typeof retryPool>> | undefined;
  let holder: PoolClient | undefined;
  let lockedOperation: string | undefined;
  let storeIdentity: { ino: number; dev: number } | undefined;
  let baseline: string | undefined;
  let qualified: RetryFixture | undefined;
  const store = join(e.private, 't06-runtime');
  const deadline = Date.now() + 360_000;
  const until = async (condition: () => Promise<boolean>) => {
    while (Date.now() < deadline) { if (connectionLost) throw new Error('RETRY_FIXTURE_CONNECTION_LOST'); if (await condition()) return; await pause(500); }
    throw new Error('RETRY_FIXTURE_DEADLINE');
  };
  // Persist hashes privately, never contents; do not follow any link in the store.
  const inventory = async () => {
    const rows: { relative: string; mode: number; ino: number; dev: number; hash?: string }[] = [];
    const visit = async (path: string, relative: string) => {
      const info = await lstat(path);
      if (info.isSymbolicLink() || info.uid !== process.getuid?.() || (!info.isDirectory() && !info.isFile())) throw new Error('RETRY_FIXTURE_STORE_REFUSED');
      const mode = info.mode & 0o7777;
      if (mode !== (info.isDirectory() ? 0o700 : 0o400)) throw new Error('RETRY_FIXTURE_STORE_MODE');
      rows.push({ relative, mode, ino: info.ino, dev: info.dev, ...(info.isFile() ? { hash: createHash('sha256').update(await readFile(path)).digest('hex') } : {}) });
      if (info.isDirectory()) for (const name of (await readdir(path)).sort()) await visit(join(path, name), relative ? relative + '/' + name : name);
    };
    await visit(store, ''); return JSON.stringify(rows);
  };
  const verifyStore = async () => {
    const info = await lstat(store);
    if (!storeIdentity || info.isSymbolicLink() || !info.isDirectory() || info.ino !== storeIdentity.ino || info.dev !== storeIdentity.dev
        || info.uid !== process.getuid?.() || (info.mode & 0o7777) !== 0o700 || await realpath(store) !== store || await inventory() !== baseline) throw new Error('RETRY_FIXTURE_RESTORATION_REFUSED');
  };
  const restore = async () => {
    try {
      const info = await lstat(store);
      if (!storeIdentity || info.isSymbolicLink() || info.ino !== storeIdentity.ino || info.dev !== storeIdentity.dev || await realpath(store) !== store) throw new Error('RETRY_FIXTURE_RESTORATION_IDENTITY');
      await chmod(store, 0o700);
      await verifyStore();
      faultApplied = false;
    } catch { restorationIssue = true; throw new Error('RETRY_FIXTURE_RESTORATION_REFUSED'); }
  };
  try {
    if (!e.syntheticOnly || e.root !== process.cwd() || e.project !== 's01-' + createHash('sha256').update(e.root).digest('hex').slice(0, 12)
        || e.private !== '/dev/shm/' + e.project || await realpath(e.private) !== e.private || (await statfs(e.private)).type !== 0x01021994) throw new Error('RETRY_FIXTURE_IDENTITY');
    const privateInfo = await lstat(e.private), info = await lstat(store);
    if (privateInfo.isSymbolicLink() || privateInfo.uid !== process.getuid?.() || (privateInfo.mode & 0o7777) !== 0o700
        || !info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid?.() || (info.mode & 0o7777) !== 0o700 || await realpath(store) !== store) throw new Error('RETRY_FIXTURE_IDENTITY');
    storeIdentity = { ino: info.ino, dev: info.dev };
    db = await retryPool('control_migrator', 2); history = await retryPool('inngest');
    db.on('error', () => { connectionLost = true; }); history.on('error', () => { connectionLost = true; });
    const central = db, engine = history;
    phase = 'PRECONDITIONS';
    await captureCreatedAgency();
    const registry = JSON.parse(await readFile('.local/fixture-manifests/registry.json', 'utf8')) as { t06: RetryFixture[]; t07: RetryFixture[] };
    const deliveredIds = [...registry.t06, ...registry.t07].map(tuple => tuple.operationId);
    const idle = async () => (await central.query(`SELECT g.state='IDLE' AND g.execution_id IS NULL
      AND NOT EXISTS(SELECT 1 FROM control.provisioning_execution WHERE state IN ('RUNNING','BLOCKED')) AS idle
      FROM control.provisioning_gate g WHERE singleton=true`)).rows[0]?.idle === true;
    await until(async () => {
      await retryWorkersRunning(); if (!await idle()) return false;
      const pending = (await central.query(`SELECT count(*)::int AS n FROM control.provisioning_operation o
        WHERE o.id=ANY($1::uuid[]) AND (o.status IN ('PENDING','RUNNING') OR (o.status='FAILED' AND o.retryable))`, [deliveredIds])).rows[0]?.n;
      return pending === 0;
    });
    // The canary is created before the baseline and retained with the environment.
    await writeFile(join(store, '.pr4-canary-' + randomUUID()), randomBytes(32), { flag: 'wx', mode: 0o400 });
    baseline = await inventory();
    await writeFile('.local/fixture-manifests/pr4-store-before-' + randomUUID() + '.json', baseline + '\n', { flag: 'wx', mode: 0o600 });
    if (!await idle()) throw new Error('RETRY_FIXTURE_BASELINE_RACE');
    phase = 'FAIL_UNISSUED';
    faultApplied = true; await chmod(store, 0o500);
    const fixture = await create();
    const snapshot = async () => {
      const row = (await central.query(`SELECT a.state,a.version::text AS agency_version,o.status,o.version::text AS operation_version,
        o.attempt,o.retryable,o.wakeup_generation::text AS generation,
        (SELECT count(*)::int FROM control.provisioning_execution WHERE operation_id=o.id) AS executions,
        (SELECT count(*)::int FROM control.provisioning_execution WHERE operation_id=o.id AND state='CLOSED' AND backends='[]'::jsonb) AS unissued_closed,
        (SELECT count(*)::int FROM control.provisioning_effect WHERE operation_id=o.id AND target_version=1) AS effects,
        (SELECT count(*)::int FROM control.provisioning_effect WHERE operation_id=o.id AND kind='LOCATOR_RESERVED' AND status='CONFIRMED') AS reserved,
        (SELECT count(*)::int FROM control.provisioning_effect WHERE operation_id=o.id AND kind<>'LOCATOR_RESERVED' AND status<>'PLANNED') AS emitted,
        (SELECT count(*)::int FROM control.audit_event WHERE resource_id=o.id AND event_type='agency.provisioning.failed-unissued') AS failures,
        (SELECT count(*)::int FROM pg_database WHERE datname='ag_'||replace(a.id::text,'-','')) AS databases,
        (SELECT count(*)::int FROM pg_roles WHERE rolname=ANY(ARRAY['agr_'||replace(a.id::text,'-',''),'agm_'||replace(a.id::text,'-','')])) AS roles,
        (SELECT count(*)::int FROM control.database_locator WHERE agency_id=a.id AND schema_version=0 AND verification_version=0) AS unissued_locator
        FROM control.agency a JOIN control.provisioning_operation o ON o.agency_id=a.id WHERE a.id=$1 AND o.id=$2 AND a.activated_at IS NULL`, [fixture.agencyId, fixture.operationId])).rows[0];
      return row;
    };
    await until(async () => {
      await retryWorkersRunning(); const row = await snapshot();
      if (!row || row.attempt > 1 || (row.state === 'FAILED' && !row.retryable)) throw new Error('RETRY_FIXTURE_UNEXPECTED_FAILURE');
      return row.state === 'FAILED' && row.status === 'FAILED' && row.attempt === 1 && row.retryable === true && await idle();
    });
    const failed = await snapshot();
    if (failed.executions !== 1 || failed.unissued_closed !== 1 || failed.effects !== 6 || failed.reserved !== 1 || failed.emitted !== 0
        || failed.failures !== 1 || failed.databases !== 0 || failed.roles !== 0 || failed.unissued_locator !== 1) throw new Error('RETRY_FIXTURE_EFFECT_EMITTED');
    phase = 'RESTORE_AND_LOCK';
    await restore();
    holder = await central.connect();
    holder.on('error', () => { connectionLost = true; });
    const lock = await holder.query("SELECT pg_try_advisory_lock(hashtextextended('s01.t06.operation:'||$1,0)) AS locked", [fixture.operationId]);
    if (lock.rows[0]?.locked !== true) throw new Error('RETRY_FIXTURE_OPERATION_RACE');
    lockedOperation = fixture.operationId;
    const unchanged = async () => {
      const row = await snapshot();
      if (row?.state !== 'FAILED' || row.status !== 'FAILED' || row.attempt !== 1 || !row.retryable
          || row.agency_version !== failed.agency_version || row.operation_version !== failed.operation_version || row.executions !== 1 || !await idle()) throw new Error('RETRY_FIXTURE_OPERATION_RACE');
      return row;
    };
    await unchanged();
    const eventsDone = async () => {
      const outbox = (await central.query(`SELECT event_id,status FROM control.outbox WHERE agency_id=$1
        AND type IN ('agency.creation-accepted','agency.provisioning-wakeup') ORDER BY event_id`, [fixture.agencyId])).rows;
      if (!outbox.length || outbox.some(row => row.status !== 'DELIVERED')) return undefined;
      const ids = outbox.map(row => row.event_id as string);
      const runs = (await engine.query(`SELECT e.event_id,f.run_id,
        bool_or(h.type='FunctionCompleted') AS completed,
        bool_or(h.type='StepCompleted' AND h.step_name='durable-attempt') AS step_completed
        FROM events e JOIN function_runs f ON f.event_id=e.internal_id LEFT JOIN history h ON h.run_id=f.run_id
        WHERE e.event_id=ANY($1::text[]) GROUP BY e.event_id,f.run_id ORDER BY e.event_id,f.run_id`, [ids])).rows;
      if (ids.some(id => !runs.some(row => row.event_id === id)) || runs.some(row => !row.completed || !row.step_completed)) return undefined;
      return JSON.stringify({ outbox, runs });
    };
    phase = 'THREE_NATIVE_ROUNDS';
    await until(async () => {
      await retryWorkersRunning(); await unchanged();
      const rounds = (await central.query(`SELECT w.delivery_round,b.status,
        w.created_at<=clock_timestamp()-interval '30 seconds' AS aged
        FROM control.provisioning_wakeup w JOIN control.outbox b USING(event_id)
        WHERE w.operation_id=$1 AND w.expected_operation_version=$2 AND w.target_attempt=2 ORDER BY delivery_round`, [fixture.operationId, failed.operation_version])).rows;
      return rounds.length === 3 && rounds.every((row, index) => row.delivery_round === index + 1 && row.status === 'DELIVERED')
        && rounds[2]?.aged === true && (await eventsDone()) !== undefined;
    });
    const drained = await eventsDone();
    if (!drained) throw new Error('RETRY_FIXTURE_LATE_WAKE');
    const unlock = await holder.query("SELECT pg_advisory_unlock(hashtextextended('s01.t06.operation:'||$1,0)) AS unlocked", [lockedOperation]);
    if (unlock.rows[0]?.unlocked !== true) throw new Error('RETRY_FIXTURE_UNLOCK_REFUSED');
    lockedOperation = undefined; holder.release(); holder = undefined;
    const noLock = async () => (await central.query(`WITH k AS (SELECT hashtextextended('s01.t06.operation:'||$1,0) AS v)
      SELECT count(*)::int AS n FROM pg_locks l,k WHERE l.locktype='advisory' AND l.granted AND l.objsubid=1
      AND l.classid=((k.v>>32)&4294967295)::oid AND l.objid=(k.v&4294967295)::oid`, [fixture.operationId])).rows[0]?.n === 0;
    phase = 'UNLOCKED_STABILITY';
    const stable = JSON.stringify(await unchanged());
    const start = Date.now();
    do {
      if (Date.now() >= deadline || connectionLost) throw new Error('RETRY_FIXTURE_DEADLINE_OR_CONNECTION_LOST');
      await retryWorkersRunning();
      if (!await noLock() || ((await lstat(store)).mode & 0o7777) !== 0o700 || JSON.stringify(await unchanged()) !== stable || await eventsDone() !== drained) throw new Error('RETRY_FIXTURE_UNSTABLE');
      await pause(500);
    } while (Date.now() - start < 75_000);
    await captureCreatedAgency();
    await verifyStore();
    qualified = fixture;
  } catch { throw new Error('RETRY_FIXTURE_' + phase + '_FAILED'); }
  finally {
    let restorationFailed = false;
    if (faultApplied) { try { await restore(); } catch { restorationFailed = true; } }
    if (holder) {
      try {
        if (lockedOperation && (await holder.query("SELECT pg_advisory_unlock(hashtextextended('s01.t06.operation:'||$1,0)) AS unlocked", [lockedOperation])).rows[0]?.unlocked !== true) restorationFailed = true;
      } catch { restorationFailed = true; }
      holder.release(true);
    }
    try { await history?.end(); await db?.end(); } catch { restorationFailed = true; }
    if (baseline !== undefined) { try { await verifyStore(); } catch { restorationFailed = true; } }
    if (restorationFailed || restorationIssue) throw new Error('RETRY_FIXTURE_RESTORATION_FAILED_NEW_INCIDENT');
  }
  if (!qualified || connectionLost) throw new Error('RETRY_FIXTURE_FINAL_PROOF_FAILED');
  console.log('T08 retry fixture: PASS; real failed-unissued; three completed native rounds; workers running restart0; unlocked stable75s; final inventory verified; no emitted effects');
  return qualified;
}

export async function retryDurableEvidence(fixture: RetryFixture) {
  let pool: Awaited<ReturnType<typeof retryPool>> | undefined;
  try {
    pool = await retryPool('control_migrator');
    const row = (await pool.query(`SELECT a.state,o.attempt,o.version::text AS operation_version,
      (SELECT count(*)::int FROM control.audit_event WHERE resource_id=o.id AND event_type='agency.provisioning.retried.v1' AND actor_type='human') AS human_retries
      FROM control.agency a JOIN control.provisioning_operation o ON o.agency_id=a.id WHERE a.id=$1 AND o.id=$2`, [fixture.agencyId, fixture.operationId])).rows[0];
    if (!row) throw new Error(); return row as { state: string; attempt: number; operation_version: string; human_retries: number };
  } catch { throw new Error('RETRY_DURABLE_EVIDENCE_UNAVAILABLE'); }
  finally { await pool?.end(); }
}
