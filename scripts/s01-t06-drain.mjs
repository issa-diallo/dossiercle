import { execFileSync } from 'node:child_process';
import { fixturePool } from './s01-fixture-manifests.mjs';
const compose = ['compose', '--profile', 't06', '--env-file', '.local/compose.env', '-f', 'infra/local/compose.yaml'];
execFileSync('docker', [...compose, 'stop', 't06-orchestrator'], { stdio: 'inherit', timeout: 30000 });
const pool = await fixturePool(), client = await pool.connect();
try {
    const locked = (await client.query("SELECT pg_try_advisory_lock(hashtextextended('s01.t06.singleton',0)) AS locked")).rows[0].locked;
    if (!locked)
        throw new Error('T06_DRAIN_EXECUTION_IN_PROGRESS');
    const gate = (await client.query('SELECT state,execution_id FROM control.provisioning_gate')).rows[0];
    if (gate.state !== 'IDLE' || gate.execution_id !== null)
        throw new Error('T06_DRAIN_RECONCILIATION_REQUIRED');
    execFileSync('docker', [...compose, 'stop', 't06-provisioner'], { stdio: 'inherit', timeout: 30000 });
    console.log('T06_IDENTIFIED_RUNTIME_DRAINED');
}
finally {
    await client.query('SELECT pg_advisory_unlock_all()').catch(() => { });
    client.release();
    await pool.end();
}
