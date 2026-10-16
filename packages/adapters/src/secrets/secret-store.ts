import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { open, lstat, mkdir, link, unlink, realpath } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { basename } from 'node:path';
export interface SecretBinding {
    agencyId: string;
    operationId: string;
    secretRef: string;
    version: number;
    kind: 'runtime' | 'migration';
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export class FileSecretStore {
    constructor(private readonly root: string, private readonly owner = process.getuid?.()) { }
    async publish(binding: SecretBinding, bytes: Uint8Array): Promise<{
        fingerprint: string;
    }> {
        this.validate(binding);
        if (bytes.byteLength < 16)
            throw new Error('SECRET_INPUT_REFUSED');
        const root = resolve(this.root);
        await this.assertDirectory(root, 0o700, true);
        const dir = join(root, binding.agencyId);
        await mkdir(dir, { mode: 0o700 }).catch(e => {
            if ((e as NodeJS.ErrnoException).code !== 'EEXIST')
                throw e;
        });
        await this.assertDirectory(dir, 0o700, false);
        const final = join(dir, `${binding.secretRef}.v${binding.version}.${binding.kind}.secret`);
        const manifest = join(dir, `${binding.secretRef}.v${binding.version}.${binding.kind}.json`);
        const expected = { ...binding, sha256: digest(bytes) };
        const lockPath = join(dir, `.${binding.secretRef}.v${binding.version}.${binding.kind}.lock`);
        let lock;
        try {
            lock = await open(lockPath, 'wx', 0o400);
        }
        catch {
            throw new Error('SECRET_PUBLICATION_BUSY');
        }
        try {
            const hasSecret = await this.readPrivate(final).then(() => true, e => {
                if ((e as NodeJS.ErrnoException).code === 'ENOENT')
                    return false;
                throw e;
            });
            const hasManifest = await this.readPrivate(manifest).then(() => true, e => {
                if ((e as NodeJS.ErrnoException).code === 'ENOENT')
                    return false;
                throw e;
            });
            if (hasSecret || hasManifest) {
                if (!hasSecret || !hasManifest)
                    throw new Error('SECRET_PUBLICATION_UNCERTAIN');
                const [old, oldManifest] = await Promise.all([this.readPrivate(final), this.readPrivate(manifest).then(bytes => bytes.toString('utf8'))]);
                if (!old.equals(Buffer.from(bytes)) || JSON.stringify(JSON.parse(oldManifest)) !== JSON.stringify(expected))
                    throw new Error('SECRET_BINDING_CONFLICT');
                await this.assertFile(final);
                await this.assertFile(manifest);
                return { fingerprint: expected.sha256 };
            }
            const secretTmp = join(dir, `.${randomUUID()}.tmp`), manifestTmp = join(dir, `.${randomUUID()}.tmp`);
            await this.writePrivate(secretTmp, bytes);
            await this.writePrivate(manifestTmp, Buffer.from(JSON.stringify(expected)));
            try {
                await link(secretTmp, final);
                await link(manifestTmp, manifest);
                const d = await open(dir, 'r');
                try {
                    await d.sync();
                }
                finally {
                    await d.close();
                }
            }
            finally {
                await unlink(secretTmp).catch(() => { });
                await unlink(manifestTmp).catch(() => { });
            }
            await this.assertFile(final);
            await this.assertFile(manifest);
            return { fingerprint: expected.sha256 };
        }
        finally {
            await lock.close();
            await unlink(lockPath).catch(() => { });
        }
    }
    async read(binding: SecretBinding): Promise<Buffer> {
        this.validate(binding);
        await this.assertDirectory(resolve(this.root), 0o700, true);
        const dir = join(resolve(this.root), binding.agencyId);
        await this.assertDirectory(dir, 0o700, false);
        const target = join(dir, `${binding.secretRef}.v${binding.version}.${binding.kind}.secret`);
        const manifest = join(dir, `${binding.secretRef}.v${binding.version}.${binding.kind}.json`);
        await this.assertFile(target);
        await this.assertFile(manifest);
        const [bytes, raw] = await Promise.all([this.readPrivate(target), this.readPrivate(manifest).then(bytes => bytes.toString('utf8'))]);
        const metadata = JSON.parse(raw) as SecretBinding & {
            sha256: string;
        };
        if (Object.keys(metadata).sort().join(',') !== 'agencyId,kind,operationId,secretRef,sha256,version' || metadata.agencyId !== binding.agencyId || metadata.operationId !== binding.operationId || metadata.secretRef !== binding.secretRef || metadata.version !== binding.version || metadata.kind !== binding.kind || metadata.sha256 !== digest(bytes))
            throw new Error('SECRET_BINDING_DIVERGED');
        return bytes;
    }
    private validate(binding: SecretBinding) {
        if (!uuid.test(binding.agencyId) || !uuid.test(binding.operationId) || !uuid.test(binding.secretRef) || !Number.isInteger(binding.version) || binding.version < 1 || !['runtime', 'migration'].includes(binding.kind))
            throw new Error('SECRET_INPUT_REFUSED');
    }
    private async assertDirectory(path: string, mode: number, root: boolean) {
        const s = await lstat(path);
        if (s.isSymbolicLink() || !s.isDirectory() || (s.mode & 0o777) !== mode || (this.owner !== undefined && s.uid !== this.owner))
            throw new Error('SECRET_DIRECTORY_REFUSED');
        if (root && await realpath(path) !== path)
            throw new Error('SECRET_ROOT_REFUSED');
    }
    private async assertFile(path: string) {
        const s = await lstat(path);
        if (s.isSymbolicLink() || !s.isFile() || (s.mode & 0o777) !== 0o400 || (this.owner !== undefined && s.uid !== this.owner))
            throw new Error('SECRET_FILE_REFUSED');
        if (await realpath(dirname(path)) !== dirname(path) || basename(path).includes('..'))
            throw new Error('SECRET_PATH_REFUSED');
    }
    private async readPrivate(path: string): Promise<Buffer> {
        const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
            const stat = await file.stat();
            if (!stat.isFile() || (stat.mode & 0o777) !== 0o400
                || (this.owner !== undefined && stat.uid !== this.owner))
                throw new Error('SECRET_FILE_REFUSED');
            return await file.readFile();
        }
        finally {
            await file.close();
        }
    }
    private async writePrivate(path: string, bytes: Uint8Array) {
        const file = await open(path, 'wx', 0o400);
        try {
            await file.writeFile(bytes);
            await file.sync();
        }
        finally {
            await file.close();
        }
    }
}
