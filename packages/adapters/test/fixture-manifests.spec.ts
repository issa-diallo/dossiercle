import { describe, it, expect } from 'vitest';
const modulePath = new URL('../../../scripts/s01-fixture-manifests.mjs', import.meta.url).href;
const { validatePartition, inventory, classifyInventory } = await import(modulePath);
const a = { rootId: '11111111-1111-4111-8111-111111111111', subjectId: '22222222-2222-4222-8222-222222222222',
    agencyId: '33333333-3333-4333-8333-333333333333', operationId: '44444444-4444-4444-8444-444444444444' };
const b = { rootId: '55555555-5555-4555-8555-555555555555', subjectId: '66666666-6666-4666-8666-666666666666',
    agencyId: '77777777-7777-4777-8777-777777777777', operationId: '88888888-8888-4888-8888-888888888888' };
describe('exhaustive disjoint private fixture partition', () => {
    it('requires the exact central union and refuses omissions or cross-scope substitutions', () => {
        expect(() => validatePartition([a, b], [a], [b], { requireT06: true })).not.toThrow();
        expect(() => validatePartition([a, b], [a], [])).toThrow('FIXTURE_MANIFEST_OMISSION');
        expect(() => validatePartition([a, b], [a], [{ ...b, agencyId: a.agencyId }])).toThrow('FIXTURE_MANIFEST_OVERLAP');
        expect(() => validatePartition([a], [a], [b])).toThrow('FIXTURE_MANIFEST_EXTRA');
        expect(() => validatePartition([a, b], [a, a], [b])).toThrow('FIXTURE_MANIFEST_OVERLAP');
    });
    it('validates each central receipt before deduplicating valid replay keys', async () => {
        const row = { actor_id: a.subjectId, subject_id: a.subjectId, root_id: a.rootId, agency_id: a.agencyId,
            operation_id: a.operationId, result: { agencyId: a.agencyId, operationId: a.operationId } };
        expect(await inventory({ query: async () => ({ rows: [row, row] }) })).toEqual([a]);
        await expect(inventory({ query: async () => ({ rows: [row, { ...row, result: { agencyId: b.agencyId } }] }) }))
            .rejects.toThrow('FIXTURE_PROVENANCE_INVALID');
    });
    it('classifies a committed T06 receipt by its durable precommit intent and refuses an uncertain intent', () => {
        const registry = { t05: [a], t06: [] };
        expect(classifyInventory([a, b], registry, [b])).toEqual({ t05: [a], t06: [b] });
        expect(() => classifyInventory([a], registry, [b])).toThrow('FIXTURE_T06_INTENT_PENDING');
        expect(registry).toEqual({ t05: [a], t06: [] });
        // A receipt observed after a failed runner is still T06; default capture cannot reclassify it.
        expect(classifyInventory([a, b], { t05: [a, b], t06: [] }, [b])).toEqual({ t05: [a], t06: [b] });
    });
    it('binds HTTP scopes declared before POST to authoritative UUIDs, including capture after a lost HTTP response', () => {
        expect(classifyInventory([a, b], { t05: [a], t06: [] }, [], [{ rootId: b.rootId, subjectId: b.subjectId }]))
            .toEqual({ t05: [a], t06: [b] });
        expect(classifyInventory([a], { t05: [a], t06: [] }, [], [{ rootId: b.rootId, subjectId: b.subjectId }]))
            .toEqual({ t05: [a], t06: [] });
        expect(() => classifyInventory([a, b], { t05: [a], t06: [] }, [], [{ rootId: b.rootId, subjectId: a.subjectId }]))
            .toThrow('FIXTURE_SCOPE_PROVENANCE_INVALID');
    });
});
