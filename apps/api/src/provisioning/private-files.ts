import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { z } from 'zod';
export async function privateBytes(path: string): Promise<Buffer> {
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        const stat = await file.stat();
        if (!stat.isFile() || ![0o400, 0o600].includes(stat.mode & 0o777)
            || stat.uid !== process.getuid?.())
            throw new Error('PRIVATE_FILE_REFUSED');
        return await file.readFile();
    }
    finally {
        await file.close();
    }
}
const tuple = z.strictObject({ rootId: z.uuid(), subjectId: z.uuid(), agencyId: z.uuid(), operationId: z.uuid() });
const registrySchema = z.strictObject({ version: z.literal(1), syntheticOnly: z.literal(true), root: z.string(),
    t05: z.array(tuple).min(1), t06: z.array(tuple) });
export async function fixtureRegistry(path = '/run/s01-fixtures/registry.json') {
    const value = registrySchema.parse(JSON.parse((await privateBytes(path)).toString('utf8')));
    if (!process.env['S01_T06_ROOT'] || value.root !== process.env['S01_T06_ROOT'])
        throw new Error('FIXTURE_MANIFEST_IDENTITY');
    const tuples = [...value.t05, ...value.t06];
    for (const field of ['agencyId', 'rootId', 'operationId'] as const)
        if (new Set(tuples.map(t => t[field])).size !== tuples.length)
            throw new Error('FIXTURE_MANIFEST_OVERLAP');
    return value;
}
