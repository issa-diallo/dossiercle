import { performance } from 'node:perf_hooks';
import { setTimeout as pause } from 'node:timers/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const singleton = "SELECT pg_try_advisory_lock(hashtextextended('s01.t06.singleton',0)) AS locked";
const gateRead = 'SELECT state,execution_id FROM control.provisioning_gate';
async function bounded(operation, milliseconds) {
    let timer;
    try {
        return await Promise.race([
            Promise.resolve().then(operation),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('DRAIN_CALL_DEADLINE')), milliseconds); }),
        ]);
    } finally { clearTimeout(timer); }
}

/** Ports are the actual CLI operations below; importing this controller has no native effects.
 * Only a known false lock result is retried. A query timeout is not SQL cancellation. */
export async function drainIdentifiedRuntime({ stopOrchestrator, acquireSession, stopProvisioner, onDrained,
    now = () => performance.now(), wait = milliseconds => pause(milliseconds) }) {
    let session, failed = false, code = 'T06_DRAIN_ORCHESTRATOR_STOP_FAILED';
    let attempts = 0, waitedMs = 0;
    try {
        await stopOrchestrator();
        code = 'T06_DRAIN_CONNECTION_UNAVAILABLE';
        session = await acquireSession();
        code = 'T06_DRAIN_GUARD_UNAVAILABLE';
        const start = now(), deadline = start + 5000;
        while (true) {
            if (!session.healthy()) throw new Error();
            const remaining = deadline - now();
            if (remaining <= 0) { code = 'T06_DRAIN_EXECUTION_IN_PROGRESS'; throw new Error(); }
            const budget = Math.min(1000, Math.ceil(remaining));
            attempts += 1;
            const result = await bounded(() => session.query(singleton, budget), budget);
            if (!session.healthy()) throw new Error();
            if (now() >= deadline) { code = 'T06_DRAIN_EXECUTION_IN_PROGRESS'; throw new Error(); }
            const locked = result?.rows?.length === 1 ? result.rows[0]?.locked : undefined;
            if (locked === true) break; // Advisory locks are reentrant: never probe again once acquired.
            if (locked !== false) throw new Error();
            const untilDeadline = deadline - now();
            if (untilDeadline <= 0) { code = 'T06_DRAIN_EXECUTION_IN_PROGRESS'; throw new Error(); }
            await wait(Math.min(100, untilDeadline));
        }
        waitedMs = Math.round(now() - start);
        const gateDeadline = now() + 1000;
        const gate = await bounded(() => session.query(gateRead, 1000), 1000);
        if (!session.healthy() || now() >= gateDeadline) throw new Error();
        if (gate?.rows?.length !== 1 || gate.rows[0]?.state !== 'IDLE' || gate.rows[0]?.execution_id !== null) {
            code = 'T06_DRAIN_RECONCILIATION_REQUIRED'; throw new Error();
        }
        code = 'T06_DRAIN_PROVISIONER_STOP_FAILED';
        await stopProvisioner();
        code = 'T06_DRAIN_GUARD_UNAVAILABLE';
        if (!session.healthy()) throw new Error();
    } catch { failed = true; }
    finally {
        if (session) {
            // No unlock/query after an indeterminate probe; retire the only dedicated session.
            try {
                const closeDeadline = now() + 1000;
                await bounded(() => session.retire(), 1000);
                if (now() >= closeDeadline) throw new Error();
            }
            catch { code = 'T06_DRAIN_SESSION_CLOSE_UNCONFIRMED'; failed = true; }
        }
    }
    if (failed) throw new Error(code);
    const receipt = { attempts, waitedMs };
    try { await onDrained(receipt); }
    catch { throw new Error('T06_DRAIN_RECEIPT_FAILED'); }
    return receipt;
}

/** Bind one new pool/client to a non-reusable session capability; no native dependency here. */
export async function acquireDrainSession(pool) {
    let poolFailed = false;
    pool.on('error', () => { poolFailed = true; });
    let client;
    try { client = await pool.connect(); }
    catch { await pool.end(); throw new Error('T06_DRAIN_CONNECTION_UNAVAILABLE'); }
    let ended = false, clientFailed = false, retired = false;
    // Install the receipt before any probe or release, including an already-lost session.
    const closed = new Promise(done => { client.once('end', () => { ended = true; done(); }); });
    client.on('error', () => { clientFailed = true; });
    const healthy = () => !poolFailed && !clientFailed && !ended && !retired && client.pipeline === false;
    return {
        healthy,
        query: (text, milliseconds) => {
            if (!healthy()) throw new Error('T06_DRAIN_SESSION_UNAVAILABLE');
            return client.query({ text, query_timeout: milliseconds });
        },
        retire: async () => {
            if (retired) throw new Error('T06_DRAIN_SESSION_ALREADY_RETIRED');
            retired = true;
            client.release(true); // pg8.23.1: remove, never repool; active nonpipeline queries force stream destruction.
            await closed;
            await pool.end();
            if (poolFailed || clientFailed) throw new Error('T06_DRAIN_SESSION_FAILED');
        },
    };
}

async function main() {
    // Native dependencies are deliberately absent from the importable controller path.
    const { execFileSync } = await import('node:child_process');
    const { fixturePool } = await import('./s01-fixture-manifests.mjs');
    const compose = ['compose', '--profile', 't06', '--env-file', '.local/compose.env', '-f', 'infra/local/compose.yaml'];
    const stop = service => execFileSync('docker', [...compose, 'stop', service], { stdio: 'inherit', timeout: 30000 });
    await drainIdentifiedRuntime({
        stopOrchestrator: () => stop('t06-orchestrator'),
        acquireSession: async () => acquireDrainSession(await fixturePool()),
        stopProvisioner: () => stop('t06-provisioner'),
        onDrained: receipt => {
            console.log('T06_DRAIN_QUIESCENCE_CONFIRMED ' + JSON.stringify(receipt));
            console.log('T06_IDENTIFIED_RUNTIME_DRAINED');
        },
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
