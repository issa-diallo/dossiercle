import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'pg';
import { ProvisioningAttempt, withVerificationAuthority } from '../src/postgres/provisioning-attempt.js';
import type { ProvisioningSession } from '../src/postgres/provisioning-session.js';
function deferred() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; }
function setup() {
    const scope = { agency_id: 'agency', operation_status: 'RUNNING', agency_state: 'PROVISIONING',
        invitation_status: 'CLAIMED', identity_status: 'CONFIRMED', membership_role: 'ADMIN',
        membership_state: 'PENDING', authority_status: 'CONFIRMED', confirmed_epoch: '1', identity_epoch: '1' };
    const query = vi.fn(async (sql: string) => ({ rows: sql.includes('lock_provisioning_scope') ? [scope] : [{ exists: 1 }] }));
    const session = { client: { query }, verify: async () => { } } as unknown as ProvisioningSession;
    return { query, attempt: new ProvisioningAttempt(session, 'operation', 'execution', async () => { }, {} as Pool) };
}
describe('technical verification task barrier', () => {
    it('registers detached checks before sealing, holds locks through drain and refuses new tasks', async () => {
        const { attempt, query } = setup(), entered = deferred(), release = deferred();
        let token: Awaited<ReturnType<typeof attempt.verificationContext>>;
        const effect = attempt.run('AUDIT_CONFIRMED', async () => {
            token = await attempt.verificationContext();
            void withVerificationAuthority(token, async () => { entered.resolve(); await release.promise; });
        });
        await entered.promise;
        await Promise.resolve();
        expect(query.mock.calls.some(([sql]) => sql === 'COMMIT')).toBe(false);
        await expect(withVerificationAuthority(token!, async () => { })).rejects.toThrow('TENANT_VERIFICATION_CLOSED');
        release.resolve();
        await effect;
        await expect(withVerificationAuthority(token!, async () => { })).rejects.toThrow('TENANT_VERIFICATION_CLOSED');
        expect(query.mock.calls.some(([sql]) => sql === 'COMMIT')).toBe(true);
    });
    it('drains a detached action before rollback when parent fails', async () => {
        const { attempt, query } = setup(), entered = deferred(), release = deferred();
        const effect = attempt.run('AUDIT_CONFIRMED', async () => {
            const token = await attempt.verificationContext();
            void withVerificationAuthority(token, async () => { entered.resolve(); await release.promise; });
            throw new Error('PARENT_FAILED');
        });
        const rejected = expect(effect).rejects.toThrow('PARENT_FAILED');
        await entered.promise;
        expect(query.mock.calls.some(([sql]) => sql === 'ROLLBACK')).toBe(false);
        release.resolve();
        await rejected;
        expect(query.mock.calls.some(([sql]) => sql === 'ROLLBACK')).toBe(true);
    });
    it('propagates a detached verification rejection before commit even when the child catches it', async () => {
        const { attempt, query } = setup();
        await expect(attempt.run('AUDIT_CONFIRMED', async () => {
            const token = await attempt.verificationContext();
            await withVerificationAuthority(token, async () => { throw new Error('VERIFICATION_FAILED'); }).catch(() => { });
        })).rejects.toThrow('VERIFICATION_FAILED');
        expect(query.mock.calls.some(([sql]) => sql === 'COMMIT')).toBe(false);
        expect(query.mock.calls.some(([sql]) => sql === 'ROLLBACK')).toBe(true);
    });
    it('never revives a previous run token when the same attempt starts its next effect', async () => {
        const { attempt } = setup();
        let old: Awaited<ReturnType<typeof attempt.verificationContext>>;
        await attempt.run('AUDIT_CONFIRMED', async () => { old = await attempt.verificationContext(); });
        await attempt.run('AUDIT_CONFIRMED', async () => {
            await expect(withVerificationAuthority(old!, async () => { })).rejects.toThrow('TENANT_VERIFICATION_CLOSED');
            const current = await attempt.verificationContext();
            await expect(withVerificationAuthority(current, async () => true)).resolves.toBe(true);
        });
    });
});
