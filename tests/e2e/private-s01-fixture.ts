import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from '../../packages/adapters/dist/postgres/runtime-pool.js';
import { e } from '../auth/private-t05-native.js';

const run = promisify(execFile);
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
