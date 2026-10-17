import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'pg';
import { TenantRouter, type TenantRouterDependencies } from '../src/postgres/tenant-router.js';
const session = { subjectId: '11111111-1111-4111-8111-111111111111', agencyId: '22222222-2222-4222-8222-222222222222', sessionEpoch: 1n };
function setup(state: 'READY' | 'ACTIVE' = 'ACTIVE') {
    const pools: unknown[] = [];
    const dependencies: TenantRouterDependencies = { authorize: async () => true, withAuthority: async (_identity, work) => work(), locator: async (agencyId) => ({ agencyId, state, databaseName: 'ag_22222222222242228222222222222222', runtimeRole: 'agr_22222222222242228222222222222222', secretRef: 'opaque', secretVersion: 1, verificationVersion: 1n }), resolve: async () => ({ host: '127.0.0.1', port: 5432, database: 'ag_22222222222242228222222222222222', user: 'agr_22222222222242228222222222222222', password: 'secret' }), createPool: options => { const pool = { connect: vi.fn(), end: vi.fn() }; pools.push({ options, pool }); return pool as unknown as Pool; } };
    return { router: new TenantRouter(dependencies), pools, dependencies };
}
describe('tenant router', () => {
    it('never routes a READY T06 agency to business tables', async () => { const { router } = setup('READY'); await expect(router.query(await router.context(session), 'SELECT 1')).rejects.toThrow('TENANT_NOT_ACTIVE'); await router.close(); });
    it('rechecks authorization and binds pools to verified locator versions', async () => { const { router, dependencies, pools } = setup(); const context = await router.context(session); await router.query(context, 'SELECT 1').catch(() => { }); expect(pools).toHaveLength(1); dependencies.authorize = async () => false; await expect(router.query(context, 'SELECT 1')).rejects.toThrow('TENANT_AUTHORIZATION_CLOSED'); await router.close(); });
    it('rejects copied contexts', async () => { const { router } = setup(); const context = await router.context(session); await expect(router.query({ ...context }, 'SELECT 1')).rejects.toThrow('TENANT_CONTEXT_REFUSED'); await router.close(); });
    it('rejects a secret resolving to another database or role', async () => { const { router, dependencies } = setup(); dependencies.resolve = async () => ({ host: '127.0.0.1', port: 5432, database: 'other_db', user: 'agr_22222222222242228222222222222222', password: 'secret' }); await expect(router.query(await router.context(session), 'SELECT 1')).rejects.toThrow('TENANT_SECRET_BINDING_REFUSED'); await router.close(); });
});
