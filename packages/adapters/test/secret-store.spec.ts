import { mkdtemp, mkdir, chmod, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it, expect } from 'vitest';
import { FileSecretStore } from '../src/secrets/secret-store.js';
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
describe('versioned secret store', () => {
    it('publishes exclusively, verifies bindings and reads the same version on replay', async () => {
        const base = await mkdtemp(join(tmpdir(), 't06-secret-'));
        roots.push(base);
        const root = join(base, 'vault');
        await mkdir(root, { mode: 0o700 });
        await chmod(root, 0o700);
        const store = new FileSecretStore(root), binding = { agencyId: '11111111-1111-4111-8111-111111111111', operationId: '22222222-2222-4222-8222-222222222222', secretRef: '33333333-3333-4333-8333-333333333333', version: 1, kind: 'runtime' as const };
        const bytes = Buffer.alloc(48, 7);
        const first = await store.publish(binding, bytes);
        expect(await store.read(binding)).toEqual(bytes);
        expect(await store.publish(binding, bytes)).toEqual(first);
        await expect(store.publish({ ...binding, operationId: '44444444-4444-4444-8444-444444444444' }, bytes)).rejects.toThrow();
        await expect(store.publish({ ...binding, version: 2 }, bytes)).resolves.toBeDefined();
    });
    it('refuses a symlinked agency directory', async () => {
        const base = await mkdtemp(join(tmpdir(), 't06-secret-'));
        roots.push(base);
        const root = join(base, 'vault');
        await mkdir(root, { mode: 0o700 });
        await chmod(root, 0o700);
        const outside = join(base, 'outside');
        await mkdir(outside, { mode: 0o700 });
        await chmod(outside, 0o700);
        const binding = { agencyId: '11111111-1111-4111-8111-111111111111', operationId: '22222222-2222-4222-8222-222222222222', secretRef: '33333333-3333-4333-8333-333333333333', version: 1, kind: 'runtime' as const };
        await symlink(outside, join(root, binding.agencyId));
        await expect(new FileSecretStore(root).publish(binding, Buffer.alloc(32, 1))).rejects.toThrow('SECRET_DIRECTORY_REFUSED');
    });
});
