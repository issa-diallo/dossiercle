import { mkdir, readFile, rename, writeFile, lstat, readdir, open } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { constants } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const require = createRequire(new URL('../packages/adapters/package.json', import.meta.url));
const { Pool } = require('pg');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const file = '.local/fixture-manifests/registry.json';
const key = t => [t.rootId, t.subjectId, t.agencyId, t.operationId].join(':');
export async function environment() {
    const e = JSON.parse(await readFile('.local/environment.json', 'utf8'));
    if (e.syntheticOnly !== true || e.root !== process.cwd())
        throw new Error('SYNTHETIC_REQUIRED');
    return e;
}
export async function fixturePool() {
    const e = await environment();
    return new Pool({ host: '127.0.0.1', port: e.pgPort, database: 'control',
        user: 'control_api', password: (await readFile(e.private + '/pg/control_api', 'utf8')).trim(), max: 1 });
}
export async function inventory(pool) {
    const rows = (await pool.query(`SELECT i.actor_id,i.result,i.resource_id AS root_id,
  a.id AS agency_id,o.id AS operation_id,v.subject_id
  FROM control.idempotency_record i
  LEFT JOIN control.agency a ON a.invitation_root_id=i.resource_id
  LEFT JOIN control.provisioning_operation o ON o.agency_id=a.id
  LEFT JOIN control.agency_invitation v ON v.root_id=i.resource_id
  WHERE i.operation_type='t05.agency-create.v1'`)).rows;
    const tuples = new Map();
    for (const r of rows) {
        const t = { rootId: r.root_id, subjectId: r.subject_id, agencyId: r.agency_id, operationId: r.operation_id };
        if (Object.values(t).some(id => !uuid.test(id ?? '')) || r.actor_id !== r.subject_id
            || r.result?.agencyId !== r.agency_id || r.result?.operationId !== r.operation_id)
            throw new Error('FIXTURE_PROVENANCE_INVALID');
        tuples.set(key(t), t);
    }
    return [...tuples.values()].sort((a, b) => key(a).localeCompare(key(b)));
}
export function validatePartition(actual, t05, t06, { requireT06 = false, t07 = [] } = {}) {
    if (!Array.isArray(t05) || !Array.isArray(t06) || !t05.length || (requireT06 && !t06.length))
        throw new Error('FIXTURE_MANIFEST_EMPTY');
    const expected = new Set(actual.map(key)), seen = new Set(), agency = new Set(), root = new Set(), op = new Set();
    for (const t of [...t05, ...t06, ...t07]) {
        if (Object.keys(t).sort().join(',') !== 'agencyId,operationId,rootId,subjectId'
            || Object.values(t).some(id => typeof id !== 'string' || !uuid.test(id)))
            throw new Error('FIXTURE_TUPLE_INVALID');
        if (seen.has(key(t)) || agency.has(t.agencyId) || root.has(t.rootId) || op.has(t.operationId))
            throw new Error('FIXTURE_MANIFEST_OVERLAP');
        if (!expected.has(key(t)))
            throw new Error('FIXTURE_MANIFEST_EXTRA');
        seen.add(key(t));
        agency.add(t.agencyId);
        root.add(t.rootId);
        op.add(t.operationId);
    }
    if (seen.size !== expected.size)
        throw new Error('FIXTURE_MANIFEST_OMISSION');
}
async function readRegistry() {
    const e = await environment();
    try {
        const st = await lstat(file);
        if (!st.isFile() || st.isSymbolicLink() || (st.mode & 0o777) !== 0o600 || st.uid !== process.getuid())
            throw new Error('FIXTURE_MANIFEST_MODE');
        const registry = JSON.parse(await readFile(file, 'utf8'));
        if (registry.version !== 1 || registry.syntheticOnly !== true || registry.root !== e.root)
            throw new Error('FIXTURE_MANIFEST_IDENTITY');
        return { ...registry, t07: Array.isArray(registry.t07) ? registry.t07 : [] };
    }
    catch (error) {
        if (error.code === 'ENOENT')
            return { version: 1, syntheticOnly: true, root: e.root, t05: [], t06: [], t07: [] };
        throw error;
    }
}
async function save(registry) {
    await mkdir('.local/fixture-manifests', { mode: 0o700, recursive: true });
    const temp = file + '.' + randomUUID();
    await writeFile(temp, JSON.stringify(registry), { flag: 'wx', mode: 0o600 });
    await rename(temp, file);
}
function validateTuple(tuple) {
    if (!tuple || Object.keys(tuple).sort().join(',') !== 'agencyId,operationId,rootId,subjectId'
        || Object.values(tuple).some(id => typeof id !== 'string' || !uuid.test(id)))
        throw new Error('FIXTURE_TUPLE_INVALID');
}
async function ensureIntentDirectory() {
    for (const path of ['.local', '.local/fixture-manifests']) {
        try {
            await mkdir(path, { mode: 0o700 });
        }
        catch (error) {
            if (error.code !== 'EEXIST')
                throw error;
        }
        const st = await lstat(path);
        if (!st.isDirectory() || st.isSymbolicLink() || (st.mode & 0o777) !== 0o700 || st.uid !== process.getuid())
            throw new Error('FIXTURE_INTENT_DIRECTORY_REFUSED');
    }
    try {
        await mkdir('.local/fixture-manifests/intents', { mode: 0o700 });
    }
    catch (error) {
        if (error.code !== 'EEXIST')
            throw error;
    }
    const st = await lstat('.local/fixture-manifests/intents');
    if (!st.isDirectory() || st.isSymbolicLink() || (st.mode & 0o777) !== 0o700 || st.uid !== process.getuid())
        throw new Error('FIXTURE_INTENT_DIRECTORY_REFUSED');
    const parent = await open('.local/fixture-manifests', 'r');
    try {
        await parent.sync();
    }
    finally {
        await parent.close();
    }
}
async function writeIntent(name, contents) {
    await ensureIntentDirectory();
    const fd = await open('.local/fixture-manifests/intents/' + name, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o400);
    try {
        await fd.writeFile(JSON.stringify(contents));
        await fd.sync();
    }
    finally {
        await fd.close();
    }
    const directory = await open('.local/fixture-manifests/intents', 'r');
    try {
        await directory.sync();
    }
    finally {
        await directory.close();
    }
}
/** Persisted before SQL creation; never inferred from eventual READY/FAILED state. */
export async function declareT06(tuple) {
    validateTuple(tuple);
    const e = await environment();
    await writeIntent(tuple.operationId + '.json', { version: 1, root: e.root, syntheticOnly: true, tuple });
    return readRegistry();
}
/** T07 tuple intent is durable before any central fixture rows are committed. */
export async function declareT07(tuple) {
    validateTuple(tuple);
    const e = await environment();
    await writeIntent(tuple.operationId + '.json', { version: 1, root: e.root, syntheticOnly: true, partition:'t07', tuple });
    return readRegistry();
}
/** HTTP allocates agency/op UUIDs. Its private test scope is declared before POST. */
export async function declareT06Scope(pool, scope) {
    if (!scope || Object.keys(scope).sort().join(',') !== 'rootId,subjectId'
        || Object.values(scope).some(id => typeof id !== 'string' || !uuid.test(id)))
        throw new Error('FIXTURE_SCOPE_INVALID');
    const row = (await pool.query(`SELECT subject_id,status FROM control.agency_invitation WHERE root_id=$1`, [scope.rootId])).rows[0];
    const registry = await readRegistry();
    if (row?.subject_id !== scope.subjectId || row.status !== 'CLAIMED' || registry.t05.some(t => t.rootId === scope.rootId))
        throw new Error('FIXTURE_SCOPE_PROVENANCE_INVALID');
    const e = await environment();
    await writeIntent('scope-' + scope.rootId + '.json', { version: 1, root: e.root, syntheticOnly: true, scope });
}
export async function declareT07Scope(pool, scope) {
    if (!scope || Object.keys(scope).sort().join(',') !== 'rootId,subjectId'
        || Object.values(scope).some(id => typeof id !== 'string' || !uuid.test(id))) throw new Error('FIXTURE_SCOPE_INVALID');
    const row=(await pool.query('SELECT subject_id,status FROM control.agency_invitation WHERE root_id=$1',[scope.rootId])).rows[0];
    const registry=await readRegistry();
    if(row?.subject_id!==scope.subjectId||row.status!=='CLAIMED'||[...registry.t05,...registry.t06,...registry.t07].some(t=>t.rootId===scope.rootId))
        throw new Error('FIXTURE_SCOPE_PROVENANCE_INVALID');
    const e=await environment();
    await writeIntent('scope-'+scope.rootId+'.json',{version:1,root:e.root,syntheticOnly:true,scope,partition:'t07'});
}
async function readIntents() {
    const e = await environment(), directory = '.local/fixture-manifests/intents';
    let names;
    try {
        names = await readdir(directory);
    }
    catch (error) {
        if (error.code === 'ENOENT')
            return { tuples: [], t07Tuples: [], scopes: [], t07Scopes: [] };
        throw error;
    }
    const st = await lstat(directory);
    if (!st.isDirectory() || st.isSymbolicLink() || (st.mode & 0o777) !== 0o700)
        throw new Error('FIXTURE_INTENT_DIRECTORY_REFUSED');
    const tuples = [], t07Tuples = [], scopes = [], t07Scopes = [];
    for (const name of names) {
        if (!/^(?:scope-)?[a-f0-9-]{36}\.json$/.test(name))
            throw new Error('FIXTURE_INTENT_NAME_REFUSED');
        const fd = await open(directory + '/' + name, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
            const stat = await fd.stat();
            if (!stat.isFile() || (stat.mode & 0o777) !== 0o400 || stat.uid !== process.getuid())
                throw new Error('FIXTURE_INTENT_REFUSED');
            const value = JSON.parse(await fd.readFile('utf8'));
            if (value.version !== 1 || value.root !== e.root || value.syntheticOnly !== true)
                throw new Error('FIXTURE_INTENT_IDENTITY');
            if (name.startsWith('scope-')) {
                if (!value.scope || !['rootId,subjectId','partition,rootId,subjectId'].includes(Object.keys(value.scope).sort().join(','))
                    || [value.scope.rootId,value.scope.subjectId].some(id => typeof id !== 'string' || !uuid.test(id))
                    || name !== 'scope-' + value.scope.rootId + '.json')
                    throw new Error('FIXTURE_SCOPE_INVALID');
                if(value.partition==='t07')t07Scopes.push(value.scope);
                else if(value.partition===undefined)scopes.push(value.scope);
                else throw new Error('FIXTURE_SCOPE_INVALID');
            }
            else {
                validateTuple(value.tuple);
                if (name !== value.tuple.operationId + '.json')
                    throw new Error('FIXTURE_INTENT_IDENTITY');
                if (value.partition === 't07') t07Tuples.push(value.tuple);
                else if (value.partition === undefined) tuples.push(value.tuple);
                else throw new Error('FIXTURE_INTENT_INVALID');
            }
        }
        finally {
            await fd.close();
        }
    }
    return { tuples, t07Tuples, scopes, t07Scopes };
}
export function classifyInventory(actual, registry, intents, scopes = [], t07Scopes = [], t07Intents = []) {
    const currentT07=registry.t07??[];
    const authoritative = new Set(actual.map(key)), known = new Set([...registry.t05, ...registry.t06, ...currentT07].map(key));
    const scoped = actual.filter(t => scopes.some(scope => {
        if (scope.rootId !== t.rootId)
            return false;
        if (scope.subjectId !== t.subjectId)
            throw new Error('FIXTURE_SCOPE_PROVENANCE_INVALID');
        return true;
    }));
    const scopedT07=actual.filter(t=>t07Scopes.some(scope=>{
        if(scope.rootId!==t.rootId)return false;
        if(scope.subjectId!==t.subjectId)throw new Error('FIXTURE_SCOPE_PROVENANCE_INVALID');
        return true;
    }));
    const t07Declared = new Set([...t07Intents, ...scopedT07].map(key));
    const declared = new Set([...intents, ...scoped, ...t07Intents].map(key));
    for(const tuple of scopedT07)declared.add(key(tuple));
    if (intents.some(t => !authoritative.has(key(t))))
        throw new Error('FIXTURE_T06_INTENT_PENDING');
    if (t07Intents.some(t => !authoritative.has(key(t))))
        throw new Error('FIXTURE_T07_INTENT_PENDING');
    if ([...known].some(t => !authoritative.has(t)))
        throw new Error('FIXTURE_INVENTORY_DISAPPEARED');
    const next = { ...registry, t05: registry.t05.filter(t => !declared.has(key(t))), t06: [...registry.t06], t07:[...currentT07] };
    for (const tuple of actual) {
        if(t07Declared.has(key(tuple))){if(!next.t07.some(t=>key(t)===key(tuple)))next.t07.push(tuple);}
        else if (declared.has(key(tuple))) {
            if (!next.t06.some(t => key(t) === key(tuple)))
                next.t06.push(tuple);
        }
        else if (!known.has(key(tuple)))
            next.t05.push(tuple);
    }
    if (actual.length)
        validatePartition(actual, next.t05, next.t06, {t07:next.t07});
    return next;
}
export async function captureDefault(pool) {
    // Intents are read AFTER the SQL snapshot: any receipt in it was declared first.
    const actual = await inventory(pool), intents = await readIntents();
    const registry = classifyInventory(actual, await readRegistry(), intents.tuples, intents.scopes,intents.t07Scopes,intents.t07Tuples);
    await save(registry);
    return registry;
}
export async function registerT06(pool, tuple) {
    if (!tuple || Object.keys(tuple).sort().join(',') !== 'agencyId,operationId,rootId,subjectId'
        || Object.values(tuple).some(id => typeof id !== 'string' || !uuid.test(id)))
        throw new Error('FIXTURE_TUPLE_INVALID');
    const registry = await captureDefault(pool), actual = await inventory(pool);
    if (!actual.some(t => key(t) === key(tuple)))
        throw new Error('FIXTURE_PROVENANCE_INVALID');
    registry.t05 = registry.t05.filter(t => key(t) !== key(tuple));
    if (!registry.t06.some(t => key(t) === key(tuple)))
        registry.t06.push(tuple);
    validatePartition(actual, registry.t05, registry.t06,{t07:registry.t07});
    await save(registry);
    return registry;
}
export async function registerT07(pool,tuple){
    validateTuple(tuple);const registry=await captureDefault(pool),actual=await inventory(pool);
    if(!actual.some(t=>key(t)===key(tuple)))throw new Error('FIXTURE_PROVENANCE_INVALID');
    registry.t05=registry.t05.filter(t=>key(t)!==key(tuple));registry.t06=registry.t06.filter(t=>key(t)!==key(tuple));
    if(!registry.t07.some(t=>key(t)===key(tuple)))registry.t07.push(tuple);
    validatePartition(actual,registry.t05,registry.t06,{t07:registry.t07});await save(registry);return registry;
}
export async function inspectPartition(pool, requireT06 = false) {
    const actual = await inventory(pool), intents = await readIntents(), registry = await readRegistry();
    const present = new Set(actual.map(key));
    const scoped = actual.filter(t => intents.scopes.some(scope => scope.rootId === t.rootId && scope.subjectId === t.subjectId));
    const t07Scoped=actual.filter(t=>intents.t07Scopes.some(scope=>scope.rootId===t.rootId&&scope.subjectId===t.subjectId));
    if ([...intents.tuples, ...scoped].some(t => !present.has(key(t)) || !registry.t06.some(v => key(v) === key(t)))
        ||intents.t07Tuples.some(t=>!present.has(key(t))||!registry.t07.some(v=>key(v)===key(t)))
        ||t07Scoped.some(t=>!present.has(key(t))||!registry.t07.some(v=>key(v)===key(t))))
        throw new Error('FIXTURE_T06_INTENT_PENDING');
    validatePartition(actual, registry.t05, registry.t06, { requireT06,t07:registry.t07 });
    return registry;
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    const pool = await fixturePool();
    try {
        const r = process.argv[2] === 'declare' ? await declareT06(JSON.parse(process.argv[3])) : process.argv[2] === 'declare-t07' ? await declareT07Scope(pool,JSON.parse(process.argv[3])) : process.argv[2] === 'declare-t07-tuple' ? await declareT07(JSON.parse(process.argv[3])) : process.argv[2] === 'capture' ? await captureDefault(pool) : process.argv[2] === 'register' ? await registerT06(pool, JSON.parse(process.argv[3])) : process.argv[2] === 'register-t07' ? await registerT07(pool,JSON.parse(process.argv[3])) : await inspectPartition(pool);
        process.stdout.write(JSON.stringify({ syntheticOnly: true, t05: r.t05.length, t06: r.t06.length,t07:r.t07.length, exhaustive: true, disjoint: true }) + '\n');
    }
    finally {
        await pool.end();
    }
}
