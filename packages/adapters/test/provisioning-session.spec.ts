import { EventEmitter } from 'node:events';
import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'pg';
import { ProvisioningSession } from '../src/postgres/provisioning-session.js';
function setup() {
    const client = Object.assign(new EventEmitter(), { query: vi.fn(async (sql: string) => ({
            rows: sql.includes('pg_try_advisory_lock') ? [{ locked: true }] : sql.includes('pg_locks') ? [{ n: 2 }] : [],
        })), release: vi.fn() });
    const pool = { connect: async () => client } as unknown as Pool;
    return { client, pool };
}
describe('provisioning session capability lifetime', () => {
    it('releases normal completion without invoking lost-capability destructors', async () => {
        const { pool, client } = setup(), session = (await ProvisioningSession.acquire(pool))!;
        const destroy = vi.fn();
        session.onLost(destroy);
        await session.lockOperation('operation');
        await session.verify();
        await session.close();
        expect(destroy).not.toHaveBeenCalled();
        expect(client.release).toHaveBeenCalledExactlyOnceWith(true);
        expect(() => session.assertValid()).toThrow('PROVISIONING_LOCK_LOST');
    });
    it('invalidates once on socket loss and never obtains a replacement session', async () => {
        const { pool, client } = setup(), session = (await ProvisioningSession.acquire(pool))!;
        const destroy = vi.fn();
        session.onLost(destroy);
        client.emit('error', new Error('CONNECTION_LOST'));
        client.emit('end');
        expect(destroy).toHaveBeenCalledTimes(1);
        await expect(session.verify()).rejects.toThrow('PROVISIONING_LOCK_LOST');
        await session.close();
    });
});
