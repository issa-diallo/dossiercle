import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, it, expect } from 'vitest';
import { createT06Fixture, t06Pool } from './private-t06-fixture.js';
import { ProvisioningRepository } from '@dossiercle/adapters/postgres/provisioning.repository';
const exec = promisify(execFile);
describe('bounded durable T06 wakeup ledger', () => {
    it('serializes scans, reuses PENDING, rolls back reservation and suspends after three delivered rounds', async () => {
        const fixture = await createT06Fixture(true), transactionFixture = await createT06Fixture(true);
        const dispatcher = await t06Pool('control_dispatcher', 'control', 2), central = await t06Pool('control_migrator');
        const provisioner = await t06Pool('provisioner'), api = await t06Pool('control_api');
        try {
            await expect(api.query('SELECT control.reserve_t06_wakeup($1)', [fixture.operationId])).rejects.toMatchObject({ code: '42501' });
            const client = await dispatcher.connect();
            try {
                await client.query('BEGIN');
                expect((await client.query('SELECT control.reserve_t06_wakeup($1) AS event', [transactionFixture.operationId])).rows[0].event).toBeTruthy();
                await client.query('ROLLBACK');
            }
            finally {
                client.release();
            }
            expect((await central.query('SELECT wakeup_generation::text FROM control.provisioning_operation WHERE id=$1', [transactionFixture.operationId])).rows[0].wakeup_generation).toBe('0');
            const concurrent = await Promise.all([dispatcher.query('SELECT control.reserve_t06_wakeup($1) AS event', [fixture.operationId]),
                dispatcher.query('SELECT control.reserve_t06_wakeup($1) AS event', [fixture.operationId])]);
            const first = concurrent[0]!.rows[0].event;
            expect(first).toBeTruthy();
            expect(concurrent[1]!.rows[0].event).toBe(first);
            expect((await dispatcher.query('SELECT control.reserve_t06_wakeup($1) AS event', [fixture.operationId])).rows[0].event).toBe(first);
            const old = (await central.query(`SELECT o.*,w.expected_operation_version::text,w.target_attempt,w.delivery_round
    FROM control.outbox o JOIN control.provisioning_wakeup w USING(event_id) WHERE o.event_id=$1`, [first])).rows[0];
            for (let round = 1; round <= 3; round++) {
                const latest = (await central.query('SELECT * FROM control.provisioning_wakeup WHERE operation_id=$1 ORDER BY generation DESC LIMIT 1', [fixture.operationId])).rows[0];
                expect(latest.delivery_round).toBe(round);
                // Explicit host fixture acknowledgements and PG-clock advancement isolate SQL reservation semantics.
                await dispatcher.query("UPDATE control.outbox SET status='DELIVERED' WHERE event_id=$1", [latest.event_id]);
                await central.query("UPDATE control.provisioning_wakeup SET created_at=clock_timestamp()-interval '31 seconds' WHERE event_id=$1", [latest.event_id]);
                const next = (await dispatcher.query('SELECT control.reserve_t06_wakeup($1) AS event', [fixture.operationId])).rows[0].event;
                if (round < 3)
                    expect(next).toBeTruthy();
                else
                    expect(next).toBeNull();
            }
            const before = (await central.query('SELECT version::text,wakeup_generation::text,status,attempt FROM control.provisioning_operation WHERE id=$1', [fixture.operationId])).rows[0];
            expect(before).toEqual({ version: '1', wakeup_generation: '3', status: 'PENDING', attempt: 0 });
            await exec(process.execPath, ['scripts/s01-t06-resume-operation.mjs', fixture.operationId, '--confirm-synthetic'], { timeout: 30000 });
            const after = (await central.query('SELECT version::text,wakeup_generation::text FROM control.provisioning_operation WHERE id=$1', [fixture.operationId])).rows[0];
            expect(after).toEqual({ version: '2', wakeup_generation: '3' });
            const data = { schemaVersion: 1, agencyId: fixture.agencyId, resourceId: fixture.operationId, version: old.version.toString(),
                expectedOperationVersion: old.expected_operation_version, targetAttempt: old.target_attempt, deliveryRound: old.delivery_round };
            expect(await new ProvisioningRepository(provisioner).validateEvent({ id: first, name: 'agency.provisioning-wakeup', data }, async () => { })).toBeNull();
            const next = (await dispatcher.query('SELECT control.reserve_t06_wakeup($1) AS event', [fixture.operationId])).rows[0].event;
            const latest = (await central.query('SELECT generation::text,delivery_round FROM control.provisioning_wakeup WHERE event_id=$1', [next])).rows[0];
            expect(latest).toEqual({ generation: '4', delivery_round: 1 });
        }
        finally {
            await dispatcher.end();
            await central.end();
            await provisioner.end();
            await api.end();
        }
    });
});
