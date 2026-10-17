import { FileSecretStore } from '@dossiercle/adapters/secrets/secret-store';
import { ProvisioningService } from '../src/provisioning/provisioning.service.js';
import { createHash, randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { httpFixture } from './private-t05-http-fixture.js';
import { pool, journal } from './private-t05-fixture.js';
import { createT06Fixture, t06Pool, t06Environment } from './private-t06-fixture.js';
const manifestsPath = new URL('../../../scripts/s01-fixture-manifests.mjs', import.meta.url).href;
const { registerT06, inspectPartition, declareT06Scope } = await import(manifestsPath);
const backlog = async () => Number((await pool.query(`SELECT count(*)::int AS n
 FROM control.agency a JOIN control.provisioning_operation o ON o.agency_id=a.id
 WHERE o.status IN ('PENDING','RUNNING') OR (o.status='FAILED' AND o.retryable)
 OR EXISTS(SELECT 1 FROM control.provisioning_execution e WHERE e.operation_id=o.id AND e.state IN ('RUNNING','BLOCKED'))`)).rows[0].n);
async function guestDigest(guest: {
    subject: string;
    root: string;
}) {
    const state = { head: await journal.head(guest.subject), tables: [] as unknown[] };
    for (const [sql, value] of [
        ['SELECT * FROM identity.account_authority WHERE subject_id=$1', guest.subject],
        ['SELECT * FROM identity.session WHERE subject_id=$1 ORDER BY cookie_hash', guest.subject],
        ['SELECT * FROM control.agency_invitation WHERE root_id=$1', guest.root],
        ['SELECT * FROM control.idempotency_record WHERE actor_id=$1 ORDER BY operation_type,key', guest.subject],
        ['SELECT * FROM control.agency WHERE invitation_root_id=$1 ORDER BY id', guest.root],
        ['SELECT * FROM control.audit_event WHERE resource_id=$1 ORDER BY event_id', guest.root],
    ] as const)
        state.tables.push((await pool.query(sql, [value])).rows);
    return createHash('sha256').update(JSON.stringify(state, (_k, v) => typeof v === 'bigint' ? v.toString() : v)).digest('hex');
}
describe('T06 real HTTP global admission bound', () => {
    it('serializes roots at99, refuses100 without refresh/J1/state mutation, permits replay and recovers capacity', async () => {
        const f = await httpFixture(), admin = await t06Pool('control_migrator');
        const created: Awaited<ReturnType<typeof createT06Fixture>>[] = [];
        const own: {
            rootId: string;
            subjectId: string;
            agencyId: string;
            operationId: string;
        }[] = [];
        const terminal = async (tuple: {
            agencyId: string;
            operationId: string;
        }) => {
            const check = (await admin.query(`SELECT o.status,o.attempt,
    (SELECT count(*)::int FROM control.database_locator l WHERE l.agency_id=o.agency_id) AS locators,
    (SELECT count(*)::int FROM control.provisioning_execution e WHERE e.operation_id=o.id) AS executions,
    (SELECT count(*)::int FROM control.provisioning_effect e WHERE e.operation_id=o.id) AS effects
    FROM control.provisioning_operation o WHERE o.id=$1 AND o.agency_id=$2`, [tuple.operationId, tuple.agencyId])).rows[0];
            if (check?.status === 'FAILED')
                return;
            if (!check || check.status !== 'PENDING' || check.attempt !== 0 || check.locators || check.executions || check.effects)
                throw new Error('SYNTHETIC_LOAD_SCOPE_UNSAFE');
            const registry = await inspectPartition(admin, true);
            if (!registry.t06.some((t: {
                agencyId: string;
                operationId: string;
            }) => t.agencyId === tuple.agencyId && t.operationId === tuple.operationId))
                throw new Error('SYNTHETIC_LOAD_NOT_CLASSIFIED');
            const client = await admin.connect();
            try {
                await client.query('BEGIN');
                const a = await client.query("UPDATE control.agency SET state='FAILED',version=version+1 WHERE id=$1 AND state='PROVISIONING' AND activated_at IS NULL", [tuple.agencyId]);
                const o = await client.query("UPDATE control.provisioning_operation SET status='FAILED',retryable=false,last_error_code='SYNTHETIC_LOAD_TERMINAL',version=version+1 WHERE id=$1 AND agency_id=$2 AND attempt=0 AND status='PENDING'", [tuple.operationId, tuple.agencyId]);
                if (a.rowCount !== 1 || o.rowCount !== 1)
                    throw new Error('SYNTHETIC_LOAD_RACE');
                await client.query('COMMIT');
            }
            catch (error) {
                await client.query('ROLLBACK');
                throw error;
            }
            finally {
                client.release();
            }
        };
        let failure: unknown;
        try {
            f.healthy();
            const guests: Awaited<ReturnType<typeof f.enroll>>[] = [];
            for (let n = 0; n < 2; n++) {
                const pending = await f.pending(), guest = await f.enroll(await f.service.issue(f.request(), pending.invitationId));
                expect((await f.send('POST', '/v1/onboarding/invitation/claim', '{}', f.headers(guest.request()))).status).toBe(200);
                guests.push(guest);
            }
            const current = await backlog();
            if (current >= 100)
                throw new Error('BACKLOG_PRECONDITION_FULL');
            for (let n = current; n < 99; n++)
                created.push(await createT06Fixture(true));
            expect(await backlog()).toBe(99);
            const before = await Promise.all(guests.map(guest => guestDigest(guest)));
            const refreshIndex = f.refreshSubjects.length;
            const commands = guests.map(g => g.request(randomUUID())), names = ['Admission A', 'Admission B'];
            for (const guest of guests)
                await declareT06Scope(admin, { rootId: guest.root, subjectId: guest.subject });
            const responses = await Promise.all(guests.map((_g, n) => f.send('POST', '/v1/agencies', JSON.stringify({ name: names[n] }), f.headers(commands[n]!))));
            expect(responses.map(r => r.status).sort()).toEqual([202, 429]);
            expect(await backlog()).toBe(100);
            const winner = responses.findIndex(r => r.status === 202), loser = 1 - winner;
            expect(responses[loser]!.headers['retry-after']).toBe('60');
            expect(await guestDigest(guests[loser]!)).toBe(before[loser]);
            expect(f.refreshSubjects.slice(refreshIndex).filter(s => s === guests[loser]!.subject)).toHaveLength(0);
            const win = responses[winner]!.body as {
                agencyId: string;
                operationId: string;
            };
            const winTuple = { rootId: guests[winner]!.root, subjectId: guests[winner]!.subject, agencyId: win.agencyId, operationId: win.operationId };
            own.push(winTuple);
            await registerT06(admin, winTuple);
            expect((await f.send('POST', '/v1/agencies', JSON.stringify({ name: names[winner] }), f.headers(commands[winner]!))).status).toBe(202);
            expect((await f.send('POST', '/v1/agencies', JSON.stringify({ name: 'Changed' }), f.headers(commands[winner]!))).status).toBe(409);
            expect((await f.send('POST', '/v1/agencies', JSON.stringify({ name: 'Changed' }), f.headers(guests[winner]!.request()))).status).toBe(409);
            expect((await f.send('POST', '/v1/agencies', JSON.stringify({ name: names[loser] }), f.headers(commands[loser]!))).status).toBe(429);
            expect(await guestDigest(guests[loser]!)).toBe(before[loser]);
            await terminal(created[0] ?? winTuple);
            expect(await backlog()).toBe(99);
            const resumed = await f.send('POST', '/v1/agencies', JSON.stringify({ name: names[loser] }), f.headers(commands[loser]!));
            expect(resumed.status).toBe(202);
            expect(await backlog()).toBe(100);
            const lose = resumed.body as {
                agencyId: string;
                operationId: string;
            };
            const loseTuple = { rootId: guests[loser]!.root, subjectId: guests[loser]!.subject, agencyId: lose.agencyId, operationId: lose.operationId };
            own.push(loseTuple);
            await registerT06(admin, loseTuple);
        }
        catch (error) {
            failure = error;
        }
        finally {
            const cleanupErrors: unknown[] = [];
            for (const tuple of [...created, ...own])
                try {
                    await terminal(tuple);
                }
                catch (error) {
                    cleanupErrors.push(error);
                }
            await f.app.close();
            await admin.end();
            if (failure || cleanupErrors.length)
                throw new AggregateError([...(failure ? [failure] : []), ...cleanupErrors], "ADMISSION_ASSERTION_OR_TERMINALIZATION_FAILED");
        }
    }, 90000);
    it('returns bounded READY activation status with no-store and no native refresh or human access', async () => {
        const f = await httpFixture(), central = await t06Pool('control_migrator'), e = await t06Environment();
        const provisioner = await t06Pool('provisioner', 'control', 4), ddl = await t06Pool('provisioner_ddl', 'postgres');
        try {
            f.healthy();
            const pending = await f.pending(), guest = await f.enroll(await f.service.issue(f.request(), pending.invitationId));
            expect((await f.send('POST', '/v1/onboarding/invitation/claim', '{}', f.headers(guest.request()))).status).toBe(200);
            await declareT06Scope(central, { rootId: guest.root, subjectId: guest.subject });
            const creation = await f.send('POST', '/v1/agencies', JSON.stringify({ name: 'T06 status fixture' }), f.headers(guest.request()));
            expect(creation.status).toBe(202);
            const body = creation.body as {
                agencyId: string;
                operationId: string;
            };
            const tuple = { rootId: guest.root, subjectId: guest.subject, agencyId: body.agencyId, operationId: body.operationId };
            await registerT06(central, tuple);
            const event = (await central.query("SELECT event_id FROM control.outbox WHERE agency_id=$1 AND type='agency.creation-accepted'", [body.agencyId])).rows[0];
            const service = new ProvisioningService({ pool: provisioner, ddl, host: '127.0.0.1', port: e.pgPort, instanceId: randomUUID(),
                runtimeSecrets: new FileSecretStore(e.private + '/t06-runtime'), migrationSecrets: new FileSecretStore(e.private + '/t06-migration'),
                journal, allowed: async () => [tuple] });
            expect((await service.wake(event.event_id)).disposition).toBe('closed');
            const before = await guestDigest(guest), refreshes = f.refreshSubjects.length;
            const status = await f.send('GET', `/v1/agencies/${body.agencyId}/activation`, undefined, { cookie: guest.request().cookie! });
            expect(status.status).toBe(200);
            expect(status.headers['cache-control']).toBe('no-store');
            expect(status.body).toMatchObject({ agencyId: body.agencyId, state: 'READY', step: 'READY', errorCode: null, retryable: false,
                canActivate: false, canRetry: false, automationEnabled: false });
            expect(await guestDigest(guest)).toBe(before);
            expect(f.refreshSubjects.length).toBe(refreshes);
            expect((await central.query(`SELECT a.activated_at,m.state FROM control.agency a
    JOIN identity.membership m ON m.agency_id=a.id WHERE a.id=$1`, [body.agencyId])).rows[0])
                .toEqual({ activated_at: null, state: 'PENDING' });
        }
        finally {
            await f.app.close();
            await central.end();
            await provisioner.end();
            await ddl.end();
        }
    });
});
