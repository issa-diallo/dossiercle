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
    it('does not retain listeners when the same pooled client repeatedly finds the lock busy', async () => {
        const { pool, client } = setup();
        client.query.mockResolvedValue({ rows: [{ locked: false }] });
        for (let n = 0; n < 20; n++) {
            expect(await ProvisioningSession.acquire(pool)).toBeNull();
            expect(client.listenerCount('error')).toBe(0);
            expect(client.listenerCount('end')).toBe(0);
        }
        expect(client.release).toHaveBeenCalledTimes(20);
        expect(client.release).toHaveBeenCalledWith();
    });
    it('detaches its listeners and destroys the client when acquisition fails', async () => {
        const { pool, client } = setup();
        client.query.mockRejectedValueOnce(new Error('ACQUIRE_FAILED'));
        await expect(ProvisioningSession.acquire(pool)).rejects.toThrow('ACQUIRE_FAILED');
        expect(client.listenerCount('error')).toBe(0);
        expect(client.listenerCount('end')).toBe(0);
        expect(client.release).toHaveBeenCalledExactlyOnceWith(true);
    });
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
        expect(client.listenerCount('error')).toBe(0);
        expect(client.listenerCount('end')).toBe(0);
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
