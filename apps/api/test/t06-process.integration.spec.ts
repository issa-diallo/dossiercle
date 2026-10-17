import { writeFile, readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, it, expect } from 'vitest';
import { ProvisioningService } from '../src/provisioning/provisioning.service.js';
import { FileSecretStore } from '@dossiercle/adapters/secrets/secret-store';
import { AuthorityJournal } from '@dossiercle/adapters/journal/authority-journal';
import { createT06Fixture, t06Environment, t06Pool } from './private-t06-fixture.js';
const exec = promisify(execFile);
const compose = ['compose', '--profile', 't06', '--env-file', '.local/compose.env', '-f', 'infra/local/compose.yaml'];
const docker = async (args: string[]) => (await exec('docker', args, { timeout: 45000 })).stdout.trim();
async function until<T>(read: () => Promise<T | false>, timeout = 20000): Promise<T> {
    const end = Date.now() + timeout;
    let last: unknown;
    while (Date.now() < end) {
        try {
            const result = await read();
            if (result !== false)
                return result;
        }
        catch (error) {
            last = error;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw last ?? new Error('T06_PROCESS_TIMEOUT');
}
async function stopEmitter(id: string | undefined, instanceId: string) {
    if (!id)
        return;
    const container = JSON.parse(await docker(['inspect', id]))[0];
    if (!container.Config.Cmd.includes(instanceId))
        throw new Error('T06_TEST_EMITTER_IDENTITY_REFUSED');
    if (container.State.Running) {
        await docker(['kill', '--signal', 'CONT', id]).catch(() => { });
        await docker(['stop', '--time', '5', id]);
    }
    const stopped = JSON.parse(await docker(['inspect', id]))[0];
    if (stopped.State.Running || stopped.State.Pid !== 0)
        throw new Error('T06_TEST_EMITTER_STILL_RUNNING');
}
async function identitySnapshot(central: Awaited<ReturnType<typeof t06Pool>>, ddl: Awaited<ReturnType<typeof t06Pool>>, fixture: Awaited<ReturnType<typeof createT06Fixture>>, privatePath: string) {
    const locator = (await central.query(`SELECT database_name,runtime_role,migration_role,secret_ref,
  migration_secret_ref,secret_version FROM control.database_locator WHERE agency_id=$1`, [fixture.agencyId])).rows[0];
    const database = (await ddl.query('SELECT oid::text FROM pg_database WHERE datname=$1', [locator.database_name])).rows[0]?.oid ?? null;
    const roles = (await ddl.query('SELECT rolname,oid::text FROM pg_roles WHERE rolname=ANY($1::text[]) ORDER BY rolname', [[locator.runtime_role, locator.migration_role]])).rows;
    const runtime = new FileSecretStore(privatePath + '/t06-runtime'), migration = new FileSecretStore(privatePath + '/t06-migration');
    const fingerprints = [];
    for (const kind of ['runtime', 'migration'] as const) {
        const bytes = await (kind === 'runtime' ? runtime : migration).read({ agencyId: fixture.agencyId, operationId: fixture.operationId,
            secretRef: kind === 'runtime' ? locator.secret_ref : locator.migration_secret_ref, version: 1, kind });
        fingerprints.push(createHash('sha256').update(bytes).digest('hex'));
    }
    return { locator, database, roles, fingerprints };
}
describe('T06 process session loss and host fencing', () => {
    it('rolls back a real stopped PREPARE before commit and starts again without orphan references or effects', async () => {
        const fixture = await createT06Fixture(true), e = await t06Environment(), instanceId = randomUUID();
        const central = await t06Pool('control_migrator'), pool = await t06Pool('provisioner', 'control', 4);
        const ddl = await t06Pool('provisioner_ddl', 'postgres');
        const { Pool } = await import('@dossiercle/adapters/postgres/runtime-pool');
        const host = new Pool({ host: '127.0.0.1', port: e.pgPort, database: 'postgres', user: 'synthetic_bootstrap',
            password: (await readFile(e.private + '/pg/bootstrap', 'utf8')).trim(), max: 1 });
        const name = e.project + '-t06-provisioner-1';
        let emitterId: string | undefined;
        try {
            await exec(process.execPath, ['scripts/s01-t06-drain.mjs'], { timeout: 45000 });
            await writeFile('.local/t06-process-compose.json', JSON.stringify({ services: { 't06-provisioner': {
                        command: ['/s01-node', '/app/apps/api/test/private-t06-worker.mjs', fixture.eventId, instanceId, 'PREPARE']
                    } } }), { mode: 0o600 });
            await docker([...compose, '-f', '.local/t06-process-compose.json', 'up', '-d', '--no-deps', '--force-recreate', 't06-provisioner']);
            emitterId = JSON.parse(await docker(['inspect', e.project + '-t06-provisioner-1']))[0].Id;
            await until(async () => await docker(['exec', name, 'cat', '/tmp/t06-stage']) === 'PREPARE');
            await docker(['kill', '--signal', 'STOP', name]);
            const container = JSON.parse(await docker(['inspect', name]))[0], hostPid = container.State.Pid;
            await until(async () => { const stat = await readFile(`/proc/${hostPid}/stat`, 'utf8'); return stat.slice(stat.lastIndexOf(')') + 2).startsWith('T '); });
            const lock = (await host.query('SELECT pid FROM pg_stat_activity WHERE application_name=$1', [`t06-lock:${instanceId}`])).rows[0];
            expect(lock).toBeTruthy();
            await host.query('SELECT pg_terminate_backend($1,5000)', [lock.pid]);
            expect((await central.query('SELECT attempt,status FROM control.provisioning_operation WHERE id=$1', [fixture.operationId])).rows[0])
                .toEqual({ attempt: 0, status: 'PENDING' });
            for (const [table, column, id] of [['database_locator', 'agency_id', fixture.agencyId],
                ['provisioning_effect', 'operation_id', fixture.operationId], ['provisioning_execution', 'operation_id', fixture.operationId]]) {
                expect((await central.query(`SELECT count(*)::int AS n FROM control.${table} WHERE ${column}=$1`, [id])).rows[0].n).toBe(0);
            }
            expect((await central.query('SELECT state FROM control.provisioning_gate')).rows[0].state).toBe('IDLE');
            expect((await ddl.query('SELECT count(*)::int AS n FROM pg_database WHERE datname=$1', ['ag_' + fixture.agencyId.replaceAll('-', '')])).rows[0].n).toBe(0);
            await docker(['exec', name, '/s01-node', '-e', "require('fs').writeFileSync('/tmp/t06-release','release',{mode:0o600})"]);
            await docker(['kill', '--signal', 'CONT', name]);
            expect((await until(async () => JSON.parse(await docker(['exec', name, 'cat', '/tmp/t06-result.json'])) as {
                disposition: string;
            })).disposition).toBe('blocked');
            await docker([...compose, 'stop', 't06-provisioner']);
            const stopped = JSON.parse(await docker(['inspect', name]))[0];
            expect(stopped.State.Running).toBe(false);
            expect(stopped.State.Pid).toBe(0);
            expect((await host.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name=$1', [`t06-lock:${instanceId}`])).rows[0].n).toBe(0);
            const service = new ProvisioningService({ pool, ddl, host: '127.0.0.1', port: e.pgPort, instanceId: randomUUID(),
                runtimeSecrets: new FileSecretStore(e.private + '/t06-runtime'), migrationSecrets: new FileSecretStore(e.private + '/t06-migration'),
                journal: new AuthorityJournal('.local/journal/application'), allowed: async () => [fixture] });
            expect((await service.wake(fixture.eventId)).disposition).toBe('closed');
        }
        finally {
            await stopEmitter(emitterId, instanceId);
            await central.end();
            await pool.end();
            await ddl.end();
            await host.end();
        }
    }, 90000);
    for (const fault of ['AUDIT_REFUSED', 'AUDIT_ACK_LOST']) {
        it(`keeps central READY closed on actual local ${fault} and reuses the same local audit after fenced recovery`, async () => {
            const fixture = await createT06Fixture(true), e = await t06Environment(), instanceId = randomUUID();
            const central = await t06Pool('control_migrator'), pool = await t06Pool('provisioner', 'control', 4), ddl = await t06Pool('provisioner_ddl', 'postgres');
            const runtimeSecrets = new FileSecretStore(e.private + '/t06-runtime'), migrationSecrets = new FileSecretStore(e.private + '/t06-migration');
            const { Pool } = await import('@dossiercle/adapters/postgres/runtime-pool');
            let emitterId: string | undefined;
            try {
                await exec(process.execPath, ['scripts/s01-t06-drain.mjs'], { timeout: 45000 });
                await writeFile('.local/t06-process-compose.json', JSON.stringify({ services: { 't06-provisioner': {
                            command: ['/s01-node', '/app/apps/api/test/private-t06-worker.mjs', fixture.eventId, instanceId, 'FAULT:' + fault]
                        } } }), { mode: 0o600 });
                await docker([...compose, '-f', '.local/t06-process-compose.json', 'up', '-d', '--no-deps', '--force-recreate', 't06-provisioner']);
                emitterId = JSON.parse(await docker(['inspect', e.project + '-t06-provisioner-1']))[0].Id;
                const name = e.project + '-t06-provisioner-1';
                const result = await until(async () => JSON.parse(await docker(['exec', name, 'cat', '/tmp/t06-result.json'])) as {
                    disposition: string;
                });
                expect(result.disposition).toBe('blocked');
                expect((await central.query('SELECT state FROM control.agency WHERE id=$1', [fixture.agencyId])).rows[0].state).toBe('PROVISIONING');
                expect((await central.query("SELECT status FROM control.provisioning_effect WHERE operation_id=$1 AND kind='AUDIT_CONFIRMED'", [fixture.operationId])).rows[0].status).toBe('PLANNED');
                const original = await identitySnapshot(central, ddl, fixture, e.private);
                const password = await migrationSecrets.read({ agencyId: fixture.agencyId, operationId: fixture.operationId,
                    secretRef: original.locator.migration_secret_ref, version: 1, kind: 'migration' });
                const local = new Pool({ host: '127.0.0.1', port: e.pgPort, database: original.locator.database_name,
                    user: original.locator.migration_role, password: password.toString(), max: 1 });
                try {
                    expect((await local.query('SELECT count(*)::int AS n FROM audit_event WHERE correlation=$1', [fixture.operationId])).rows[0].n)
                        .toBe(fault === 'AUDIT_REFUSED' ? 0 : 1);
                }
                finally {
                    await local.end();
                }
                const execution = (await central.query("SELECT execution_id FROM control.provisioning_execution WHERE operation_id=$1 AND state='BLOCKED'", [fixture.operationId])).rows[0];
                expect(execution).toBeTruthy();
                await exec(process.execPath, ['scripts/s01-t06-reconcile.mjs', execution.execution_id, '--confirm-synthetic'], { timeout: 45000 });
                const dispatcher = await t06Pool('control_dispatcher');
                let eventId: string;
                try {
                    eventId = (await dispatcher.query('SELECT control.reserve_t06_wakeup($1) AS event_id', [fixture.operationId])).rows[0].event_id;
                }
                finally {
                    await dispatcher.end();
                }
                const service = new ProvisioningService({ pool, ddl, host: '127.0.0.1', port: e.pgPort, instanceId: randomUUID(), runtimeSecrets, migrationSecrets,
                    journal: new AuthorityJournal('.local/journal/application'), allowed: async () => [fixture] });
                expect((await service.wake(eventId!)).disposition).toBe('closed');
                const resumed = await identitySnapshot(central, ddl, fixture, e.private);
                expect(JSON.stringify(original) === JSON.stringify(resumed)).toBe(true);
                const verify = new Pool({ host: '127.0.0.1', port: e.pgPort, database: original.locator.database_name,
                    user: original.locator.migration_role, password: password.toString(), max: 1 });
                try {
                    expect((await verify.query('SELECT count(*)::int AS n FROM audit_event WHERE correlation=$1', [fixture.operationId])).rows[0].n).toBe(1);
                }
                finally {
                    await verify.end();
                }
            }
            finally {
                await stopEmitter(emitterId, instanceId);
                await central.end();
                await pool.end();
                await ddl.end();
            }
        }, 90000);
    }
    for (const cut of ['DDL:ROLES_COMMITTED', 'DDL:CREATE_PREPARED', 'DDL:DATABASE_CREATED_CLOSED',
        'DDL:DATABASE_COMMENTED', 'DDL:DATABASE_REVOKED', 'DDL:DATABASE_OPENED', 'BEFORE:SCHEMA_MIGRATED', 'AFTER:SECRET_PUBLISHED', 'AFTER:DATABASE_CREATED', 'AFTER:SCHEMA_MIGRATED',
        'AFTER:RUNTIME_ACL', 'AFTER:AUDIT_CONFIRMED', 'BEFORE:FINALIZE']) {
        it(`keeps every emitter closed after ${cut}, SIGSTOP, lock loss and SIGCONT, then resumes after host fence`, async () => {
            const a = await createT06Fixture(true), b = await createT06Fixture(true), e = await t06Environment();
            const central = await t06Pool('control_migrator');
            const { Pool } = await import('@dossiercle/adapters/postgres/runtime-pool');
            const host = new Pool({ host: '127.0.0.1', port: e.pgPort, database: 'postgres', user: 'synthetic_bootstrap',
                password: (await readFile(e.private + '/pg/bootstrap', 'utf8')).trim(), max: 1 });
            const pool = await t06Pool('provisioner', 'control', 4), ddl = await t06Pool('provisioner_ddl', 'postgres');
            const instanceId = randomUUID();
            let emitterId: string | undefined;
            const service = new ProvisioningService({ pool, ddl, host: '127.0.0.1', port: e.pgPort, instanceId: randomUUID(),
                runtimeSecrets: new FileSecretStore(e.private + '/t06-runtime'), migrationSecrets: new FileSecretStore(e.private + '/t06-migration'),
                journal: new AuthorityJournal('.local/journal/application'), allowed: async () => [a, b] });
            try {
                await exec(process.execPath, ['scripts/s01-t06-drain.mjs'], { timeout: 45000 });
                await writeFile('.local/t06-process-compose.json', JSON.stringify({ services: { 't06-provisioner': {
                            command: ['/s01-node', '/app/apps/api/test/private-t06-worker.mjs', a.eventId, instanceId, cut]
                        } } }), { mode: 0o600 });
                await docker([...compose, '-f', '.local/t06-process-compose.json', 'up', '-d', '--no-deps', '--force-recreate', 't06-provisioner']);
                emitterId = JSON.parse(await docker(['inspect', e.project + '-t06-provisioner-1']))[0].Id;
                const name = e.project + '-t06-provisioner-1';
                await until(async () => { const result = await docker(['exec', name, 'cat', '/tmp/t06-stage']); return result === cut ? result : false; });
                await docker(['kill', '--signal', 'STOP', name]);
                const container = JSON.parse(await docker(['inspect', name]))[0];
                await until(async () => {
                    const stat = await readFile(`/proc/${container.State.Pid}/stat`, 'utf8');
                    return stat.slice(stat.lastIndexOf(')') + 2).startsWith('T ') ? true : false;
                });
                const execution = (await central.query("SELECT * FROM control.provisioning_execution WHERE operation_id=$1 AND state='RUNNING'", [a.operationId])).rows[0];
                expect(execution).toBeTruthy();
                const original = await identitySnapshot(central, ddl, a, e.private);
                if (cut.startsWith('DDL:') || cut === 'BEFORE:SCHEMA_MIGRATED' || cut === 'AFTER:SCHEMA_MIGRATED') {
                    const password = await new FileSecretStore(e.private + '/t06-runtime').read({ agencyId: a.agencyId,
                        operationId: a.operationId, secretRef: original.locator.secret_ref, version: 1, kind: 'runtime' });
                    const probe = new Pool({ host: '127.0.0.1', port: e.pgPort, database: original.locator.database_name,
                        user: original.locator.runtime_role, password: password.toString(), max: 1, connectionTimeoutMillis: 2000 });
                    try {
                        let code: string | undefined;
                        try {
                            await probe.query('SELECT 1');
                        }
                        catch (error) {
                            code = (error as {
                                code?: string;
                            }).code;
                        }
                        expect(['3D000', '55000', '42501'].includes(code ?? '')).toBe(true);
                    }
                    finally {
                        await probe.end();
                    }
                }
                const lock = (await host.query('SELECT pid FROM pg_stat_activity WHERE application_name=$1', [`t06-lock:${instanceId}`])).rows[0];
                expect(lock).toBeTruthy();
                await host.query('SELECT pg_terminate_backend($1,5000)', [lock.pid]);
                expect((await service.wake(b.eventId)).disposition).toBe('blocked');
                expect((await central.query('SELECT attempt FROM control.provisioning_operation WHERE id=$1', [b.operationId])).rows[0].attempt).toBe(0);
                await docker(['exec', name, '/s01-node', '-e', "require('fs').writeFileSync('/tmp/t06-release','release',{mode:0o600})"]);
                await docker(['kill', '--signal', 'CONT', name]);
                const result = await until(async () => JSON.parse(await docker(['exec', name, 'cat', '/tmp/t06-result.json'])) as {
                    disposition: string;
                });
                expect(result.disposition).toBe('blocked');
                expect((await central.query('SELECT state FROM control.provisioning_gate')).rows[0].state).not.toBe('IDLE');
                await exec(process.execPath, ['scripts/s01-t06-reconcile.mjs', execution.execution_id, '--confirm-synthetic'], { timeout: 45000 });
                const fenced = (await central.query('SELECT state,fencing_evidence_ref FROM control.provisioning_execution WHERE execution_id=$1', [execution.execution_id])).rows[0];
                expect(fenced.state).toBe('FENCED');
                expect(fenced.fencing_evidence_ref).toMatch(/^[a-f0-9-]{36}$/);
                const dispatcher = await t06Pool('control_dispatcher');
                let eventId: string;
                try {
                    eventId = (await dispatcher.query('SELECT control.reserve_t06_wakeup($1) AS event_id', [a.operationId])).rows[0].event_id;
                }
                finally {
                    await dispatcher.end();
                }
                expect(eventId!).toBeTruthy();
                expect((await service.wake(eventId!)).disposition).toBe('closed');
                expect((await service.wake(b.eventId)).disposition).toBe('closed');
                const resumed = await identitySnapshot(central, ddl, a, e.private);
                expect(JSON.stringify(original.locator) === JSON.stringify(resumed.locator)).toBe(true);
                expect(JSON.stringify(original.fingerprints) === JSON.stringify(resumed.fingerprints)).toBe(true);
                if (original.database !== null)
                    expect(original.database === resumed.database).toBe(true);
                if (original.roles.length)
                    expect(JSON.stringify(original.roles) === JSON.stringify(resumed.roles)).toBe(true);
                const states = (await central.query('SELECT state,activated_at FROM control.agency WHERE id=ANY($1::uuid[])', [[a.agencyId, b.agencyId]])).rows;
                expect(states).toEqual([{ state: 'READY', activated_at: null }, { state: 'READY', activated_at: null }]);
            }
            finally {
                await stopEmitter(emitterId, instanceId);
                await pool.end();
                await ddl.end();
                await central.end();
                await host.end();
            }
        }, 90000);
    }
});
