import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { open, readFile, mkdir, lstat, realpath, readdir, stat, statfs, chmod, rename } from 'node:fs/promises';
import { createHash, randomUUID, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { request as httpsRequest } from 'node:https';
import { Pool } from 'pg';
import { AuthorityJournal } from '../src/journal/authority-journal.js';
import { ControlRepository } from '../src/postgres/control.repository.js';
import { FileSecretStore, type SecretBinding } from '../src/secrets/secret-store.js';
import { AgencyRepository } from '../src/postgres/agency.repository.js';
import { SessionCipher } from '../src/identity/session-cipher.js';
import { KeycloakAdapter } from '../src/identity/keycloak-adapter.js';
import { EnrollmentAdapter } from '../src/identity/enrollment-adapter.js';
import { migrate } from '../src/postgres/migrate.js';
import type { Page } from '@playwright/test';

type Environment = { root: string; private: string; project: string; pgPort: number; tlsPort: number; syntheticOnly: boolean };
type Mount = { type: string; source: string; target: string; read_only?: boolean; bind?: object };
type Service = { image: string; volumes?: Mount[]; networks: Record<string, object>; ports?: Array<{ host_ip: string; published: string; target: number }>; environment?: Record<string, string>; healthcheck?: { test: string[] }; build?: object; profiles?: string[]; labels?: Record<string, string> };
type Compose = { name: string; services: Record<string, Service>; networks: Record<string, { name: string; internal?: boolean; external?: boolean }>; volumes: Record<string, { name: string; external?: boolean }> };
type Inspection = { Id: string; Name: string; State: { Running: boolean }; Config: { Labels: Record<string, string>; Image: string }; Mounts: Array<{ Source: string; Destination: string; RW: boolean; Type: string }>; NetworkSettings: { Networks: Record<string, { IPAddress: string }> } };
type Agency = { subject: string; root: string; id: string; operation: string; cookie: string; seed: string; serial: string; csrf: string; createKey: string; activationKey: string; activationVersion: string; name: string };
type Locator = { agency_id: string; database_name: string; runtime_role: string; migration_role: string; secret_ref: string; migration_secret_ref: string; secret_version: number; operation_id: string };
type Snapshot = { version: 1; project: string; source: string; stores: Array<{ name: string; file: string; sha256: string }>; images: Record<string, string> };
const root = process.cwd();
const project = 's01-' + createHash('sha256').update(root).digest('hex').slice(0, 12);
const gitEnvironment = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_') || ['GIT_PAGER', 'GIT_TERMINAL_PROMPT'].includes(key))), PATH: join(root, '.local/node/bin') + ':' + join(root, '.local/pnpm-native/package') + ':' + process.env['PATH'], PLAYWRIGHT_BROWSERS_PATH: join(root, '.local/playwright-browsers') };
const uid = process.getuid?.();
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const requiredServices = ['postgres', 'keycloak', 'privacyidea', 'ingress', 'mailpit', 'identity-coordinator'];
const codeRoots = ['.local/node/bin/node', 'node_modules', 'packages', 'apps/api', 'apps/web/dist', '.local/provider.jar', 'infra'];

// RM/P2L: missing prerequisites are a failure, not an empty or skipped qualification.
describe('isolated multistore restore under current authority', () => {
  it('refuses unknown snapshots, modified encrypted stores and foreign ownership before restore', () => {
    const valid: Snapshot = { version: 1, project, source: root, stores: [{ name: 'control', file: 'control.enc', sha256: 'a'.repeat(64) }], images: { postgres: 'pinned' } };
    expect(() => assertSnapshot(valid, valid, ['control'])).not.toThrow();
    for (const changed of [{ ...valid, version: 2 }, { ...valid, project: project + '-foreign' }, { ...valid, source: root + '/foreign' }, { ...valid, images: { postgres: 'unknown' } }, { ...valid, stores: [] }]) {
      expect(() => assertSnapshot(changed, valid, ['control'])).toThrow('RESTORE_MANIFEST_REFUSED');
    }
    const key = randomBytes(32), plain = randomBytes(64), sealed = encrypt(plain, key);
    expect(decrypt(sealed, key).equals(plain)).toBe(true);
    sealed[sealed.length - 1] = sealed[sealed.length - 1]! ^ 1;
    expect(() => decrypt(sealed, key)).toThrow();
    expect(() => decrypt(encrypt(plain, key), randomBytes(32))).toThrow();
    key.fill(0); plain.fill(0);
    const roles = Buffer.from('CREATE ROLE example;\nCREATE ROLE synthetic_bootstrap;\nALTER ROLE synthetic_bootstrap WITH SUPERUSER;\nGRANT example TO synthetic_bootstrap GRANTED BY synthetic_bootstrap;\n');
    expect(rolesForInitializedBootstrap(roles).toString()).toBe(roles.toString().replace('CREATE ROLE synthetic_bootstrap;', ''));
    expect(() => rolesForInitializedBootstrap(Buffer.from('CREATE ROLE example;'))).toThrow('RESTORE_BOOTSTRAP_DECLARATION_REFUSED');
    expect(() => rolesForInitializedBootstrap(Buffer.concat([roles, roles]))).toThrow('RESTORE_BOOTSTRAP_DECLARATION_REFUSED');
  });

  it('restores real native MFA stores and rejects revoked authority with unchanged old sessions', async () => {
    const fixture = await RestoreFixture.create();
    let primary: unknown;
    try {
      await fixture.seedNativeAgencies();
      await fixture.dryRunAndSnapshot();
      await fixture.restoreTarget();
      await fixture.positiveTarget();
      await fixture.negativeMatrix();
      await fixture.denySourceAndRestartTarget();
      await fixture.revokedTarget();
      await fixture.receipt();
    } catch (error) { primary = error; throw error; } finally {
      try { await fixture.stopOwnedResources(); }
      catch (cleanup) { throw primary ? new AggregateError([primary, cleanup], 'RESTORE_FAILED_AND_STOP_UNCONFIRMED') : cleanup; }
    }
  });
});

async function command(label: string, file: string, args: string[], input?: Uint8Array, timeout = 180000): Promise<Buffer> {
  console.info('restore-command', label, 'start');
  return await new Promise((resolveOutput, reject) => {
    const child = spawn(file, args, { cwd: root, env: gitEnvironment, stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks: Buffer[] = []; let bytes = 0, failed = false;
    const timer = setTimeout(() => { failed = true; child.kill('SIGTERM'); }, timeout);
    child.stdout.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > 64 * 1024 * 1024) { failed = true; child.kill('SIGTERM'); } else chunks.push(chunk); });
    child.stderr.resume();
    child.on('error', () => { failed = true; });
    child.once('close', code => { clearTimeout(timer); if (failed || code !== 0) reject(new Error('RESTORE_COMMAND_FAILED_' + label)); else { console.info('restore-command', label, 'complete'); resolveOutput(Buffer.concat(chunks)); } });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

async function privatePath(path: string, directory: boolean, mode: number) {
  const info = await lstat(path);
  if (info.isSymbolicLink() || (directory ? !info.isDirectory() : !info.isFile()) || info.uid !== uid || (info.mode & 0o777) !== mode || await realpath(path) !== path) throw new Error('RESTORE_PRIVATE_PATH_REFUSED');
}
async function exclusive(path: string, value: Uint8Array | string, mode = 0o600) {
  const file = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, mode);
  try { await file.writeFile(value); await file.sync(); } finally { await file.close(); }
}
function encrypt(plain: Uint8Array, key: Uint8Array): Buffer {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  const content = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), content]);
}
function decrypt(sealed: Buffer, key: Uint8Array): Buffer {
  if (sealed.length < 28) throw new Error('RESTORE_CIPHERTEXT_REFUSED');
  const decipher = createDecipheriv('aes-256-gcm', key, sealed.subarray(0, 12));
  decipher.setAuthTag(sealed.subarray(12, 28));
  return Buffer.concat([decipher.update(sealed.subarray(28)), decipher.final()]);
}
function assertSnapshot(value: unknown, expected: Snapshot, databases: string[]): asserts value is Snapshot {
  const candidate = value as Snapshot;
  if (!candidate || candidate.version !== 1 || candidate.project !== expected.project || candidate.source !== expected.source || JSON.stringify(candidate.images) !== JSON.stringify(expected.images)
      || !Array.isArray(candidate.stores) || JSON.stringify(candidate.stores) !== JSON.stringify(expected.stores) || candidate.stores.length !== databases.length || new Set(candidate.stores.map(store => store.name)).size !== databases.length
      || candidate.stores.some(store => !databases.includes(store.name) || store.file !== store.name + '.enc' || !/^[a-f0-9]{64}$/.test(store.sha256))) throw new Error('RESTORE_MANIFEST_REFUSED');
}
function rolesForInitializedBootstrap(plain: Buffer): Buffer {
  const text = plain.toString('utf8');
  const instruction = /^CREATE ROLE synthetic_bootstrap;$/gm;
  if (!Buffer.from(text).equals(plain) || [...text.matchAll(instruction)].length !== 1) throw new Error('RESTORE_BOOTSTRAP_DECLARATION_REFUSED');
  return Buffer.from(text.replace(instruction, ''));
}
async function capacity() {
  const disk = await statfs(root), memory = await statfs('/dev/shm');
  if (disk.bavail * disk.bsize < 1024 ** 3 || memory.type !== 0x01021994 || memory.bavail * memory.bsize < 2 * 1024 ** 3) throw new Error('RESTORE_CAPACITY_REFUSED');
}
async function noOpenJournalWriter(path: string) {
  const expected = await stat(path);
  // All spawned commands have emitted close; Docker stop/inspect establishes exit
  // of every owned source/target container before this check. Inspect only our PID,
  // never claim knowledge about unrelated host processes with restricted /proc.
  const processPath = '/proc/self';
  for (const fd of await readdir(processPath + '/fd')) {
    let actual;
    try { actual = await stat(processPath + '/fd/' + fd); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
    if (actual.dev !== expected.dev || actual.ino !== expected.ino) continue;
    const info = await readFile(processPath + '/fdinfo/' + fd, 'utf8');
    const flags = info.match(/^flags:\s+([0-7]+)$/m)?.[1];
    if (!flags || (parseInt(flags, 8) & 3) !== 0) throw new Error('RESTORE_JOURNAL_WRITER_ACTIVE');
  }
}

class RestoreFixture {
  private readonly run = randomUUID();
  private readonly directory = join(root, '.local/restore', this.run);
  private readonly targetProject = project + '-restore-' + this.run.slice(0, 8);
  private readonly targetPrivate: string;
  private readonly targetData = join(this.directory, 'target-pg');
  private readonly targetConfigFile = join(this.directory, 'target-compose.json');
  private readonly key = randomBytes(32);
  private target?: Compose;
  private snapshot?: Snapshot;
  private agencies: Agency[] = [];
  private locators: Locator[] = [];
  private readonly observations: Array<{ check: string; pass: boolean }> = [];
  private nativeBaseline?: string;
  private oldProjection?: string;
  private beforeDenyHead?: string;
  private sourceRoleHash?: string;
  private sourceSystemAclHash?: string;
  private allLocators: Locator[] = [];
  private targetStarted = false;
  private sourceStarted = true;
  private constructor(private readonly env: Environment, private readonly source: Compose) { this.targetPrivate = join(env.private, 'restore-' + this.run); }

  static async create() {
    await command('IDENTITY', 'python3', ['scripts/s01-worktree-identity-check.py', root]);
    if (uid === undefined || uid <= 0 || dirname(root).split('/').at(-1) !== 'worktrees' || root.split('/').at(-1) !== '84-s01-t09-restore') throw new Error('RESTORE_WORKTREE_REQUIRED');
    await privatePath(join(root, '.local'), true, 0o700);
    await privatePath(join(root, '.local/environment.json'), false, 0o600);
    const env = JSON.parse(await readFile(join(root, '.local/environment.json'), 'utf8')) as Environment;
    if (env.root !== root || env.project !== project || env.private !== '/dev/shm/' + project || env.syntheticOnly !== true) throw new Error('RESTORE_ENVIRONMENT_REFUSED');
    await capacity(); await privatePath(env.private, true, 0o700);
    const source = JSON.parse((await command('SOURCE_CONFIG', 'docker', ['compose', '--profile', '*', '--env-file', '.local/compose.env', '-f', 'infra/local/compose.yaml', 'config', '--format', 'json'])).toString()) as Compose;
    if (source.name !== project) throw new Error('RESTORE_SOURCE_REFUSED');
    const fixture = new RestoreFixture(env, source);
    await fixture.collisionCheck(fixture.targetProject);
    const parent = join(root, '.local/restore');
    await mkdir(parent, { mode: 0o700 }).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; });
    await privatePath(parent, true, 0o700);
    await mkdir(fixture.directory, { mode: 0o700 });
    await mkdir(fixture.targetPrivate, { mode: 0o700 });
    await exclusive(join(fixture.targetPrivate, 'backup.key'), fixture.key, 0o400);
    await exclusive(join(fixture.directory, 'ownership.json'), JSON.stringify({ version: 1, root, uid, source: project, target: fixture.targetProject, run: fixture.run }), 0o400);
    await fixture.assertServices(project, requiredServices.filter(name => name !== 'identity-coordinator'));
    return fixture;
  }

  private record(check: string) { this.observations.push({ check, pass: true }); }
  private async collisionCheck(prefix: string) {
    for (const args of [['ps', '-a', '--format', '{{.Names}}'], ['network', 'ls', '--format', '{{.Name}}'], ['volume', 'ls', '--format', '{{.Name}}']]) {
      const names = (await command('COLLISION_INVENTORY', 'docker', args)).toString().trim().split('\n');
      if (names.some(name => name === prefix || name.startsWith(prefix + '-') || name.startsWith(prefix + '_'))) throw new Error('RESTORE_RESOURCE_COLLISION');
    }
  }
  private compose(target: boolean, args: string[], input?: Uint8Array) {
    const flags = target ? ['compose', '--project-name', this.targetProject, '--profile', '*', '-f', this.targetConfigFile] : ['compose', '--profile', '*', '--env-file', '.local/compose.env', '-f', 'infra/local/compose.yaml'];
    const utility = args[0] === 'exec' ? args[3] : args[0];
    return command((target ? 'TARGET_COMPOSE_' : 'SOURCE_COMPOSE_') + String(utility).replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase(), 'docker', [...flags, ...args], input);
  }
  private async inspect(namespace: string): Promise<Inspection[]> {
    const ids = (await command('OWNED_INVENTORY', 'docker', ['ps', '-a', '--filter', 'label=com.docker.compose.project=' + namespace, '--format', '{{.ID}}'])).toString().trim().split('\n').filter(Boolean);
    if (!ids.length) return [];
    const entries = JSON.parse((await command('OWNED_INSPECT', 'docker', ['inspect', ...ids])).toString()) as Inspection[];
    if (entries.some(item => item.Config.Labels['com.docker.compose.project'] !== namespace || !item.Name.startsWith('/' + namespace + '-'))) throw new Error('RESTORE_RESOURCE_OWNER_REFUSED');
    return entries;
  }
  private async assertServices(namespace: string, required: string[]) {
    const entries = await this.inspect(namespace);
    for (const name of required) if (!entries.some(item => item.State.Running && item.Config.Labels['com.docker.compose.service'] === name)) throw new Error('RESTORE_REQUIRED_SERVICE_ABSENT');
  }
  private async stop(target: boolean) {
    if (target && !this.targetStarted) return;
    const namespace = target ? this.targetProject : project;
    await this.inspect(namespace);
    await this.compose(target, ['stop', '--timeout', '30']);
    if ((await this.inspect(namespace)).some(item => item.State.Running)) throw new Error('RESTORE_STOP_UNCONFIRMED');
    if (target) this.targetStarted = false; else this.sourceStarted = false;
    await noOpenJournalWriter(join(root, '.local/journal/application/authority.jsonl'));
    this.record(target ? 'target-stop-confirmed' : 'source-stop-confirmed');
  }
  private async startTarget() {
    if (this.sourceStarted || (await this.inspect(project)).some(item => item.State.Running)) throw new Error('RESTORE_SOURCE_STILL_RUNNING');
    await noOpenJournalWriter(join(root, '.local/journal/application/authority.jsonl'));
    await this.assertTargetConfig();
    this.targetStarted = true;
    await this.compose(true, ['up', '-d', '--wait', '--wait-timeout', '180', ...requiredServices]);
    await this.assertServices(this.targetProject, requiredServices);
    await this.assertTargetMounts();
  }
  private async db(role = 'control_coordinator', database = 'control', target = false) {
    const password = (await readFile(join(target ? this.targetPrivate : this.env.private, 'pg', role === 'synthetic_bootstrap' ? 'bootstrap' : role), 'utf8')).trim();
    return new Pool({ host: '127.0.0.1', port: this.env.pgPort, database, user: role, password, max: 1, connectionTimeoutMillis: 2000, statement_timeout: 5000, query_timeout: 6000 });
  }

  async seedNativeAgencies() {
    await command('BUILD_API', '.local/pnpm-native/package/pnpm', ['build:api'], undefined, 180000);
    await command('BUILD_WEB', '.local/pnpm-native/package/pnpm', ['build:web'], undefined, 180000);
    await this.compose(false, ['up', '-d', '--wait', '--wait-timeout', '60', 'identity-coordinator']);
    await command('REAL_T05_NATIVE_SEED', '.local/pnpm-native/package/pnpm', ['test:auth', '-g', 'T05 native owner MFA'], undefined, 900000);
    await command('NATIVE_WORKERS', 'bash', ['scripts/s01-t06-start.sh']);
    const { nativePage, nativePendingInvitation, enrollNative } = await import('../../../tests/auth/private-t05-native.js');
    for (const label of ['A', 'B']) {
      await capacity(); const browser = await nativePage();
      try {
        const invitation = await nativePendingInvitation();
        const init = browser.page.waitForResponse(response => new URL(response.url()).pathname === '/token/init' && response.request().method() === 'POST');
        const sessionPromise = enrollNative(browser.page, invitation, () => {});
        const response = await init;
        const enrollment = await response.json() as { detail?: { otpkey?: { value_b32?: string }; serial?: string } };
        const session = await sessionPromise;
        if (!session.csrfToken || !enrollment.detail?.otpkey?.value_b32 || !enrollment.detail.serial) throw new Error('RESTORE_NATIVE_MFA_REQUIRED');
        await this.browserMutation(browser.page, '/v1/onboarding/invitation/claim', {}, session.csrfToken, 200);
        const declare = `import {fixturePool,declareT07Scope,inspectPartition} from './scripts/s01-fixture-manifests.mjs';const pool=await fixturePool();try{await declareT07Scope(pool,JSON.parse(process.argv[1]));await inspectPartition(pool);}finally{await pool.end();}`;
        await command('DECLARE_NATIVE_SCOPE', process.execPath, ['--input-type=module', '-e', declare, JSON.stringify({ rootId: invitation.root, subjectId: invitation.subject })]);
        const name = 'Agence restauration ' + label, createKey = randomUUID();
        const accepted = await this.browserMutation(browser.page, '/v1/agencies', { name }, session.csrfToken, 202, { 'Idempotency-Key': createKey });
        const id = String(accepted['agencyId']), operation = String(accepted['operationId']);
        await command('CAPTURE_NATIVE_SCOPE', process.execPath, ['scripts/s01-fixture-manifests.mjs', 'capture']);
        // No client polling budget is fabricated; wait on the real read-only database snapshot.
        const pool = await this.db(), deadline = Date.now() + 240000;
        try {
          let ready = false;
          while (Date.now() < deadline) {
            const row = (await pool.query('SELECT state,version::text FROM control.agency WHERE id=$1', [id])).rows[0];
            if (row?.state === 'READY') { ready = true; break; }
            if (row?.state === 'FAILED') throw new Error('RESTORE_NATIVE_PROVISIONING_FAILED');
            await new Promise(done => setTimeout(done, 300));
          }
          if (!ready) throw new Error('RESTORE_NATIVE_PROVISIONING_TIMEOUT');
        } finally { await pool.end(); }
        const view = await browser.page.evaluate(async agencyId => await (await fetch('/v1/agencies/' + agencyId + '/activation')).json() as { version: string; state: string; canActivate: boolean }, id);
        expect(view.state).toBe('READY'); expect(view.canActivate).toBe(true);
        const activationKey = randomUUID(), activationVersion = view.version;
        await this.browserMutation(browser.page, '/v1/agencies/' + id + '/activation', {}, session.csrfToken, 200, { 'Idempotency-Key': activationKey, 'If-Match': '"' + activationVersion + '"' });
        const cookie = (await browser.context.cookies('https://localhost:' + this.env.tlsPort)).find(value => value.name === '__Host-dossiercle');
        if (!cookie) throw new Error('RESTORE_NATIVE_COOKIE_ABSENT');
        const current = await browser.page.evaluate(async () => await (await fetch('/v1/session')).json() as { scope: string; csrfToken: string; agencyId: string });
        expect(current.scope).toBe('agency'); expect(current.agencyId).toBe(id);
        this.agencies.push({ subject: invitation.subject, root: invitation.root, id, operation, cookie: cookie.name + '=' + cookie.value, seed: enrollment.detail.otpkey.value_b32, serial: enrollment.detail.serial, csrf: current.csrfToken, createKey, activationKey, activationVersion, name });
      } finally { await browser.context.close(); }
    }
    const pool = await this.db();
    try {
      this.locators = (await pool.query<Locator>(`SELECT l.*,o.id AS operation_id FROM control.database_locator l JOIN control.provisioning_operation o ON o.agency_id=l.agency_id WHERE l.agency_id=ANY($1::uuid[]) ORDER BY l.agency_id`, [this.agencies.map(agency => agency.id)])).rows;
      expect(this.locators).toHaveLength(2);
      expect(new Set(this.locators.map(locator => locator.database_name)).size).toBe(2);
      const count = (await pool.query('SELECT count(*)::int AS n FROM pg_stat_activity')).rows[0].n as number;
      expect(count).toBeLessThanOrEqual(80);
    } finally { await pool.end(); }
    for (const [index, agency] of this.agencies.entries()) {
      const locator = this.locators.find(row => row.agency_id === agency.id)!;
      const password = await new FileSecretStore(join(this.env.private, 't06-migration')).read(this.binding(locator, 'migration'));
      const pool = new Pool({ host: '127.0.0.1', port: this.env.pgPort, database: locator.database_name, user: locator.migration_role, password: password.toString(), max: 1 });
      try { await pool.query('INSERT INTO public.audit_event(event_id,event_type,resource_version,correlation) VALUES($1,$2,1,$3)', [agency.id, 'synthetic.restore.' + ['A', 'B'][index], agency.id]); }
      finally { await pool.end(); password.fill(0); }
    }
    await command('DRAIN_SOURCE', process.execPath, ['scripts/s01-t06-drain.mjs']);
    this.record('two-agencies-native-mfa-active-and-disjoint-canaries');
  }

  private async browserMutation(page: Page, path: string, body: object, csrf: string, status: number, headers: Record<string, string> = {}) {
    const result = await page.evaluate(async input => {
      const response = await fetch(input.path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': input.csrf, ...input.headers }, body: JSON.stringify(input.body) });
      return { status: response.status, body: await response.json() as Record<string, unknown> };
    }, { path, body, csrf, headers });
    if (result.status !== status) throw new Error('RESTORE_NATIVE_MUTATION_HTTP_' + result.status);
    return result.body;
  }
  private binding(locator: Locator, kind: 'runtime' | 'migration'): SecretBinding {
    return { agencyId: locator.agency_id, operationId: locator.operation_id, secretRef: kind === 'runtime' ? locator.secret_ref : locator.migration_secret_ref, version: locator.secret_version, kind };
  }

  private async initialMigrationRollback() {
    const bootstrap = await this.db('synthetic_bootstrap', 'postgres');
    try {
      for (const kind of ['control', 'agency'] as const) {
        const database = 's01_restore_dry_' + randomUUID().replaceAll('-', '');
        await bootstrap.query('CREATE DATABASE "' + database + '" OWNER synthetic_bootstrap');
        const pool = await this.db('synthetic_bootstrap', database), client = await pool.connect();
        try {
          await client.query('CREATE SCHEMA restore_fixture');
          const target = kind === 'control' ? 'control.agency' : 'public.agency_configuration';
          await client.query(`CREATE FUNCTION restore_fixture.reject_initial() RETURNS event_trigger LANGUAGE plpgsql AS $$ BEGIN
            IF current_setting('restore_fixture.reject',true)='on' AND to_regclass('${target}') IS NOT NULL THEN
              RAISE EXCEPTION 'RESTORE_REAL_DDL_FAULT';
            END IF; END $$`);
          await client.query('CREATE EVENT TRIGGER restore_initial_fault ON ddl_command_end EXECUTE FUNCTION restore_fixture.reject_initial()');
          const owner = kind === 'agency' ? randomUUID() : undefined;
          const before = (await client.query("SELECT to_regclass('s01_migration.version') AS ledger,to_regclass('control.agency') AS agency,to_regclass('public.agency_metadata') AS marker")).rows;
          expect(before).toEqual([{ ledger: null, agency: null, marker: null }]);
          await client.query("SET restore_fixture.reject='on'");
          await expect(migrate(client, kind, owner)).rejects.toThrow('MIGRATION_CLOSED');
          expect((await client.query("SELECT to_regclass('s01_migration.version') AS ledger,to_regclass('control.agency') AS agency,to_regclass('public.agency_metadata') AS marker")).rows).toEqual(before);
          await client.query("SET restore_fixture.reject='off'");
          const checksum = await migrate(client, kind, owner);
          const ledger = (await client.query('SELECT version,kind,checksum,owner_id FROM s01_migration.version')).rows;
          expect(ledger).toEqual([{ version: 1, kind, checksum, owner_id: owner ?? null }]);
          if (owner) expect((await client.query('SELECT agency_id,schema_version,migration_checksum FROM public.agency_metadata')).rows).toEqual([{ agency_id: owner, schema_version: 1, migration_checksum: checksum }]);
          await client.query('BEGIN');
          await expect(client.query('UPDATE s01_migration.version SET version=2')).rejects.toMatchObject({ code: '23514' });
          await client.query('ROLLBACK');
          expect((await client.query('SELECT version,kind,checksum,owner_id FROM s01_migration.version')).rows).toEqual(ledger);
        } finally { client.release(); await pool.end(); }
      }
    } finally { await bootstrap.end(); }
    this.record('initial-migration-real-ddl-fault-rollback-no-partial-marker-ledger-version');
  }

  private async roleMetadata(target: boolean) {
    const pool = await this.db('synthetic_bootstrap', 'postgres', target);
    try {
      const roles = (await pool.query("SELECT rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolconnlimit,rolvaliduntil,rolbypassrls,rolpassword FROM pg_authid WHERE rolname NOT LIKE 'pg_%' ORDER BY rolname")).rows;
      const memberships = (await pool.query("SELECT r.rolname AS role,u.rolname AS member,g.rolname AS grantor,m.admin_option,m.inherit_option,m.set_option FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid JOIN pg_roles u ON u.oid=m.member JOIN pg_roles g ON g.oid=m.grantor WHERE r.rolname NOT LIKE 'pg_%' ORDER BY r.rolname,u.rolname,g.rolname")).rows;
      // Password hashes are compared in memory and never printed or put in the receipt.
      return hash(JSON.stringify({ roles, memberships }));
    } finally { await pool.end(); }
  }
  private async systemDatabaseAcls(target: boolean) {
    const pool = await this.db('synthetic_bootstrap', 'postgres', target);
    try {
      const rows = (await pool.query(`SELECT d.datname AS database,g.rolname AS grantor,coalesce(u.rolname,'PUBLIC') AS grantee,a.privilege_type,a.is_grantable
        FROM pg_database d CROSS JOIN LATERAL aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) a
        LEFT JOIN pg_roles g ON g.oid=a.grantor LEFT JOIN pg_roles u ON u.oid=a.grantee
        WHERE d.datname=ANY($1::text[]) ORDER BY d.datname,g.rolname,coalesce(u.rolname,'PUBLIC'),a.privilege_type,a.is_grantable`, [['postgres', 'template0', 'template1', 'synthetic_bootstrap']])).rows;
      return hash(JSON.stringify(rows));
    } finally { await pool.end(); }
  }
  private async restoreSystemDatabaseAcls() {
    const source = await readFile(join(this.env.private, 'pg/init.sql'), 'utf8');
    const instructions = source.split('\n').filter(line => /^REVOKE CONNECT, TEMP ON DATABASE (postgres|template0|template1|synthetic_bootstrap) FROM PUBLIC;$/.test(line) || line === 'GRANT CONNECT ON DATABASE postgres TO provisioner_ddl;');
    const expected = ['postgres', 'template0', 'template1', 'synthetic_bootstrap'].map(name => 'REVOKE CONNECT, TEMP ON DATABASE ' + name + ' FROM PUBLIC;');
    expected.push('GRANT CONNECT ON DATABASE postgres TO provisioner_ddl;');
    if (instructions.length !== 5 || JSON.stringify([...instructions].sort()) !== JSON.stringify(expected.sort())) throw new Error('RESTORE_SYSTEM_ACL_BOOTSTRAP_REFUSED');
    await this.compose(true, ['exec', '-T', 'postgres', 'psql', '-U', 'synthetic_bootstrap', '-d', 'postgres', '--no-psqlrc', '--single-transaction', '--file=-', '--set', 'ON_ERROR_STOP=1'], Buffer.from(instructions.join('\n')));
    expect(await this.systemDatabaseAcls(true)).toBe(this.sourceSystemAclHash);
    this.record('system-database-acls-and-grantors-match-source-before-app-start');
  }

  private async inventorySourceLocators() {
    const pool = await this.db();
    try { this.allLocators = (await pool.query<Locator>('SELECT l.*,o.id AS operation_id FROM control.database_locator l JOIN control.provisioning_operation o ON o.agency_id=l.agency_id ORDER BY l.agency_id')).rows; }
    finally { await pool.end(); }
    if (this.allLocators.length < 2 || new Set(this.allLocators.map(locator => locator.database_name)).size !== this.allLocators.length) throw new Error('RESTORE_LOCATOR_INVENTORY_REFUSED');
    for (const locator of this.allLocators) {
      const compact = locator.agency_id.replaceAll('-', '');
      if (!/^[a-f0-9]{32}$/.test(compact) || locator.database_name !== 'ag_' + compact || locator.runtime_role !== 'agr_' + compact || locator.migration_role !== 'agm_' + compact) throw new Error('RESTORE_FOREIGN_LOCATOR_REFUSED');
      const password = await new FileSecretStore(join(this.env.private, 't06-migration')).read(this.binding(locator, 'migration'));
      const pool = new Pool({ host: '127.0.0.1', port: this.env.pgPort, database: locator.database_name, user: locator.migration_role, password: password.toString(), max: 1 });
      const client = await pool.connect();
      try { await new AgencyRepository().verify(client, locator.agency_id); }
      finally { client.release(); await pool.end(); password.fill(0); }
    }
    await exclusive(join(this.directory, 'owned-locators.json'), JSON.stringify({ version: 1, project, count: this.allLocators.length, locators: this.allLocators }));
  }
  private async assertRestoredLocators() {
    const pool = await this.db('control_coordinator', 'control', true);
    try {
      const locators = (await pool.query<Locator>('SELECT l.*,o.id AS operation_id FROM control.database_locator l JOIN control.provisioning_operation o ON o.agency_id=l.agency_id ORDER BY l.agency_id')).rows;
      expect(hash(JSON.stringify(locators))).toBe(hash(JSON.stringify(this.allLocators)));
    } finally { await pool.end(); }
    for (const locator of this.allLocators) {
      const runtime = await this.agencyClient(locator), client = await runtime.connect();
      try { await new AgencyRepository().verify(client, locator.agency_id); await new AgencyRepository().verifyRuntimeAcl(client, locator.runtime_role, locator.migration_role); }
      finally { client.release(); await runtime.end(); }
    }
    this.record('all-owned-source-locators-restored-with-markers-versions-and-acls');
  }

  async dryRunAndSnapshot() {
    // Quiesce all application/native writers before per-store pg_dump captures.
    await this.compose(false, ['stop', '--timeout', '30', ...Object.keys(this.source.services).filter(service => service !== 'postgres')]);
    const remaining = (await this.inspect(project)).filter(item => item.State.Running);
    expect(remaining.map(item => item.Config.Labels['com.docker.compose.service'])).toEqual(['postgres']);
    await this.initialMigrationRollback();
    const pool = await this.db('control_migrator'), client = await pool.connect();
    try {
      const before = (await client.query('SELECT * FROM s01_migration.version')).rows;
      expect(before).toHaveLength(1);
      await migrate(client, 'control');
      expect((await client.query('SELECT * FROM s01_migration.version')).rows).toEqual(before);
    } finally { client.release(); await pool.end(); }
    for (const locator of this.locators) {
      const password = await new FileSecretStore(join(this.env.private, 't06-migration')).read(this.binding(locator, 'migration'));
      const pool = new Pool({ host: '127.0.0.1', port: this.env.pgPort, database: locator.database_name, user: locator.migration_role, password: password.toString(), max: 1 });
      const client = await pool.connect();
      try {
        const before = (await client.query('SELECT * FROM s01_migration.version')).rows;
        await migrate(client, 'agency', locator.agency_id);
        expect((await client.query('SELECT * FROM s01_migration.version')).rows).toEqual(before);
        for (const [column, value] of [['checksum', 'f'.repeat(64)], ['kind', 'foreign'], ['owner_id', randomUUID()]] as const) {
          await client.query('BEGIN');
          await client.query('UPDATE s01_migration.version SET ' + column + '=$1', [value]);
          await expect(migrate(client, 'agency', locator.agency_id)).rejects.toThrow('MIGRATION_CLOSED');
          expect((await client.query('SELECT * FROM s01_migration.version')).rows).toEqual(before);
        }
      } finally { client.release(); await pool.end(); password.fill(0); }
    }
    this.record('migration-dry-run-idempotence-checksum-owner-rollback');
    await this.inventorySourceLocators();
    this.sourceRoleHash = await this.roleMetadata(false);
    this.sourceSystemAclHash = await this.systemDatabaseAcls(false);
    const databases = ['roles', 'control', 'privacyidea', 'keycloak', 'inngest', ...this.allLocators.map(locator => locator.database_name)];
    const stores: Snapshot['stores'] = [];
    const capturedFrom = Date.now();
    for (const name of databases) {
      await capacity();
      const args = name === 'roles' ? ['pg_dumpall', '-U', 'synthetic_bootstrap', '--roles-only'] : ['pg_dump', '-U', 'synthetic_bootstrap', '--format=custom', '--compress=0', '--create', name];
      const plain = await this.compose(false, ['exec', '-T', 'postgres', ...args]);
      if (['privacyidea', 'keycloak'].includes(name)) await this.assertDumpSecretsAbsent(plain);
      const sealed = encrypt(plain, this.key); plain.fill(0);
      await exclusive(join(this.directory, name + '.enc'), sealed);
      stores.push({ name, file: name + '.enc', sha256: hash(sealed) });
    }
    this.snapshot = { version: 1, project, source: root, stores, images: Object.fromEntries(Object.entries(this.source.services).map(([name, service]) => [name, service.image])) };
    await exclusive(join(this.directory, 'snapshot.json'), JSON.stringify(this.snapshot));
    await exclusive(join(this.directory, 'capture-window.json'), JSON.stringify({ from: capturedFrom, through: Date.now(), atomicAcrossStores: false, writersQuiesced: true }));
    this.beforeDenyHead = hash(await readFile(join(root, '.local/journal/application/authority.jsonl')));
    this.oldProjection = await this.projection(false);
    await this.stop(false);
    this.record('encrypted-multistore-snapshot-current-journal-excluded');
  }

  async restoreTarget() {
    if (!this.snapshot) throw new Error('RESTORE_SNAPSHOT_REQUIRED');
    await mkdir(this.targetData, { mode: 0o700 });
    // Transfer only this new fixture's secrets, encrypted in transit and retained in tmpfs.
    const secretDirectories = ['pg', 'kc', 'pi', 'inngest', 'pi-tls', 'ingress-tls', 'kc-tls', 'ca', 'coordinator', 'coordinator-tls', 'owner-signing', 't06-runtime', 't06-migration', 't06-provisioner-tls', 't06-orchestrator-tls', 't06-api-runtime', 't07-activation-tls'];
    const archive = await command('SECRET_ARCHIVE', 'tar', ['-C', this.env.private, '-cf', '-', ...secretDirectories]);
    const sealed = encrypt(archive, this.key); archive.fill(0);
    await exclusive(join(this.directory, 'fixture-secrets.enc'), sealed);
    const clear = decrypt(sealed, this.key);
    try { await command('SECRET_RESTORE_TMPFS', 'tar', ['-C', this.targetPrivate, '-xf', '-'], clear); } finally { clear.fill(0); }
    const manifests = await command('NEW_FIXTURE_MANIFEST_TRANSFER', 'tar', ['-C', join(root, '.local'), '-cf', '-', 'fixture-manifests']);
    const encryptedManifests = encrypt(manifests, this.key); manifests.fill(0);
    await exclusive(join(this.directory, 'fixture-manifests.enc'), encryptedManifests);
    const decodedManifests = decrypt(encryptedManifests, this.key);
    try { await command('TARGET_FIXTURE_MANIFEST_RESTORE', 'tar', ['-C', this.targetPrivate, '-xf', '-'], decodedManifests); } finally { decodedManifests.fill(0); }
    const target = structuredClone(this.source); target.name = this.targetProject;
    for (const network of Object.values(target.networks)) network.name = network.name.replace(project, this.targetProject);
    for (const volume of Object.values(target.volumes)) volume.name = volume.name.replace(project, this.targetProject);
    for (const service of Object.values(target.services)) {
      delete service.build;
      service.labels = { ...service.labels, 'dossiercle.restore.owner': this.run };
      if (service.volumes) service.volumes = service.volumes.filter(mount => mount.target !== '/docker-entrypoint-initdb.d/000.sql').map(mount => {
        const value = { ...mount };
        if (mount.type === 'bind') value.bind = { ...mount.bind, create_host_path: false };
        if (mount.source.startsWith(this.env.private + '/')) value.source = this.targetPrivate + mount.source.slice(this.env.private.length);
        if (mount.source === join(root, '.local/data_pg')) value.source = this.targetData;
        if (mount.source === join(root, '.local/fixture-manifests')) value.source = join(this.targetPrivate, 'fixture-manifests');
        if (mount.source === join(root, '.local/journal')) value.read_only = true;
        if (mount.type === 'volume') value.source = mount.source.replace(project, this.targetProject);
        return value;
      });
    }
    const postgres = target.services['postgres']!;
    postgres.environment = { ...postgres.environment, POSTGRES_USER: 'synthetic_bootstrap' };
    postgres.healthcheck = { ...postgres.healthcheck, test: ['CMD', 'pg_isready', '-h', '127.0.0.1', '-U', 'synthetic_bootstrap', '-d', 'postgres'] };
    this.target = target;
    await exclusive(this.targetConfigFile, JSON.stringify(target));
    await this.assertTargetConfig(); this.targetStarted = true;
    await this.compose(true, ['up', '-d', '--wait', '--wait-timeout', '90', 'postgres']);
    const initial = await this.db('synthetic_bootstrap', 'postgres', true);
    try {
      expect((await initial.query("SELECT oid,rolsuper FROM pg_roles WHERE rolname='synthetic_bootstrap'")).rows).toEqual([{ oid: 10, rolsuper: true }]);
      expect((await initial.query("SELECT count(*)::int AS n FROM pg_roles WHERE rolname NOT LIKE 'pg_%'")).rows[0].n).toBe(1);
    } finally { await initial.end(); }
    const stored = JSON.parse(await readFile(join(this.directory, 'snapshot.json'), 'utf8')) as unknown;
    const names = this.snapshot.stores.map(store => store.name);
    assertSnapshot(stored, this.snapshot, names);
    for (const store of this.snapshot.stores) {
      const bytes = await readFile(join(this.directory, store.file));
      if (hash(bytes) !== store.sha256) throw new Error('RESTORE_CIPHERTEXT_CHECKSUM_REFUSED');
      const plain = decrypt(bytes, this.key);
      const input = store.name === 'roles' ? rolesForInitializedBootstrap(plain) : plain;
      const args = store.name === 'roles' ? ['psql', '-U', 'synthetic_bootstrap', '-d', 'postgres', '--no-psqlrc', '--single-transaction', '--file=-', '--set', 'ON_ERROR_STOP=1'] : ['pg_restore', '-U', 'synthetic_bootstrap', '--exit-on-error', '--create', '-d', 'postgres'];
      try {
        await this.compose(true, ['exec', '-T', 'postgres', ...args], input);
        if (store.name === 'roles') {
          expect(await this.roleMetadata(true)).toBe(this.sourceRoleHash);
          await this.restoreSystemDatabaseAcls();
          this.record('bootstrap-initial-identity-and-atomic-globals-role-password-membership-fidelity');
        }
      } finally { input.fill(0); plain.fill(0); }
    }
    await this.assertRestoredLocators();
    await this.startTarget();
    expect(await this.projection(true)).toBe(this.oldProjection);
    this.record('real-pg-restore-preserves-logical-native-and-agency-identities');
  }

  private async assertTargetConfig() {
    if (!this.target || this.target.name !== this.targetProject || !this.targetProject.startsWith(project + '-restore-')) throw new Error('RESTORE_TARGET_CONFIG_REFUSED');
    for (const network of Object.values(this.target.networks)) if (network.external || !network.name.startsWith(this.targetProject + '_')) throw new Error('RESTORE_NETWORK_REFUSED');
    for (const volume of Object.values(this.target.volumes)) if (volume.external || !volume.name.startsWith(this.targetProject + '_')) throw new Error('RESTORE_VOLUME_REFUSED');
    for (const [name, service] of Object.entries(this.target.services)) {
      if (service.image !== this.source.services[name]?.image || service.labels?.['dossiercle.restore.owner'] !== this.run) throw new Error('RESTORE_IMAGE_OWNER_REFUSED');
      for (const port of service.ports ?? []) if (port.host_ip !== '127.0.0.1' || ![this.env.pgPort, this.env.tlsPort].includes(Number(port.published))) throw new Error('RESTORE_PORT_REFUSED');
      for (const mount of service.volumes ?? []) {
        if (mount.type === 'volume') { if (!Object.hasOwn(this.target.volumes, mount.source)) throw new Error('RESTORE_VOLUME_REFUSED'); continue; }
        if (mount.type !== 'bind' || mount.bind && 'create_host_path' in mount.bind && (mount.bind as { create_host_path?: boolean }).create_host_path === true) throw new Error('RESTORE_BIND_REFUSED');
        const source = resolve(mount.source);
        const code = codeRoots.some(prefix => source === join(root, prefix) || source.startsWith(join(root, prefix) + '/'));
        const journal = source === join(root, '.local/journal');
        const secret = source.startsWith(this.targetPrivate + '/');
        if (!(source === this.targetData || secret || (mount.read_only === true && (code || journal)))) throw new Error('RESTORE_SOURCE_MOUNT_REFUSED');
        const info = await lstat(source);
        if (info.isSymbolicLink() || await realpath(source) !== source) throw new Error('RESTORE_BIND_SYMLINK_REFUSED');
        if (!code && info.uid !== uid) throw new Error('RESTORE_BIND_OWNER_REFUSED');
      }
    }
    const onDisk = JSON.parse(await readFile(this.targetConfigFile, 'utf8')) as Compose;
    if (JSON.stringify(onDisk) !== JSON.stringify(this.target)) throw new Error('RESTORE_TARGET_CONFIG_CHANGED');
  }
  private async assertTargetMounts() {
    const items = await this.inspect(this.targetProject);
    for (const item of items) {
      if (item.Config.Labels['dossiercle.restore.owner'] !== this.run || Object.keys(item.NetworkSettings.Networks).some(network => !network.startsWith(this.targetProject + '_'))) throw new Error('RESTORE_TARGET_INSPECT_REFUSED');
      const service = item.Config.Labels['com.docker.compose.service']!;
      for (const mount of item.Mounts) {
        if (mount.Type === 'bind') {
          const expected = this.target!.services[service]!.volumes?.find(value => value.target === mount.Destination);
          if (!expected || expected.source !== mount.Source || mount.RW === Boolean(expected.read_only)) throw new Error('RESTORE_TARGET_MOUNT_CHANGED');
        }
      }
    }
    const coordinator = items.find(item => item.Config.Labels['com.docker.compose.service'] === 'identity-coordinator');
    expect(coordinator?.Mounts.find(mount => mount.Destination === '/var/lib/s01-journal')?.RW).toBe(false);
    const result = await this.compose(true, ['exec', '-T', 'identity-coordinator', 'python', '-c', "import errno,os; p='/var/lib/s01-journal/application/authority.jsonl'; before=os.stat(p).st_size\ntry:\n f=open(p,'ab'); f.close(); raise SystemExit(7)\nexcept OSError as e:\n assert e.errno in (errno.EROFS,errno.EACCES)\nassert os.stat(p).st_size==before"]);
    expect(result.length).toBe(0); this.record('target-journal-mounted-readonly-real-write-refused');
  }
  private async http(agency: Agency, path: string, method = 'GET', body?: object, headers: Record<string, string> = {}) {
    const ca = await readFile(join(this.targetStarted ? this.targetPrivate : this.env.private, 'ca/ca.crt'));
    return await new Promise<{ status: number; body: Record<string, unknown> }>((done, reject) => {
      const req = httpsRequest({ hostname: 'localhost', port: this.env.tlsPort, path, method, ca, rejectUnauthorized: true, headers: { Cookie: agency.cookie, ...(method === 'POST' ? { Origin: 'https://localhost:' + this.env.tlsPort, 'Content-Type': 'application/json', 'X-CSRF-Token': agency.csrf } : {}), ...headers } }, response => {
        let content = ''; response.on('data', chunk => { content += String(chunk); if (content.length > 32768) req.destroy(new Error('RESTORE_RESPONSE_LIMIT')); });
        response.on('end', () => { try { done({ status: response.statusCode ?? 0, body: content ? JSON.parse(content) as Record<string, unknown> : {} }); } catch { reject(new Error('RESTORE_INVALID_HTTP_RESPONSE')); } });
      });
      req.on('error', () => reject(new Error('RESTORE_TLS_REQUEST_FAILED'))); req.setTimeout(6000, () => req.destroy()); req.end(body ? JSON.stringify(body) : undefined);
    });
  }
  private async projection(target: boolean) {
    const pool = await this.db('control_coordinator', 'control', target);
    try {
      const authority = (await pool.query('SELECT subject_id,identity_epoch::text,status,journal_sequence::text,journal_hash FROM identity.account_authority WHERE subject_id=ANY($1::uuid[]) ORDER BY subject_id', [this.agencies.map(agency => agency.subject)])).rows;
      const sessions = (await pool.query('SELECT cookie_hash,subject_id,scope,agency_id,epoch::text,encrypted_oidc_tokens,revoked_at,last_human_activity_at,absolute_expires_at FROM identity.session WHERE subject_id=ANY($1::uuid[]) ORDER BY cookie_hash', [this.agencies.map(agency => agency.subject)])).rows;
      return hash(JSON.stringify({ authority, sessions }));
    } finally { await pool.end(); }
  }

  private async nativeState() {
    const subjects = this.agencies.map(agency => agency.subject), snapshots: unknown[] = [];
    for (const [database, queries] of [['keycloak', ['SELECT id,username,enabled FROM user_entity WHERE id=ANY($1::text[]) ORDER BY id', 'SELECT id,type,user_id,credential_data,secret_data FROM credential WHERE user_id=ANY($1::text[]) ORDER BY id']], ['privacyidea', ['SELECT row_to_json(t) AS token,row_to_json(o) AS owner FROM token t JOIN tokenowner o ON o.token_id=t.id WHERE o.user_id=ANY($1::text[]) ORDER BY t.id,o.id', 'SELECT row_to_json(i) AS info FROM tokeninfo i JOIN tokenowner o ON o.token_id=i.token_id WHERE o.user_id=ANY($1::text[]) ORDER BY i.id']]] as const) {
      const pool = await this.db('synthetic_bootstrap', database, true);
      try { for (const sql of queries) {
        const rows = (await pool.query(sql, [subjects])).rows;
        if (rows.length < this.agencies.length) throw new Error('RESTORE_NATIVE_SNAPSHOT_EMPTY');
        snapshots.push(rows);
      } }
      finally { await pool.end(); }
    }
    return hash(JSON.stringify(snapshots));
  }
  private async assertNativeSessionStillValid(agency: Agency) {
    const pool = await this.db('control_coordinator', 'control', true);
    try {
      const cookieHash = hash(agency.cookie.slice(agency.cookie.indexOf('=') + 1));
      const row = (await pool.query('SELECT * FROM identity.session WHERE cookie_hash=$1 AND subject_id=$2', [cookieHash, agency.subject])).rows[0];
      if (!row || row.revoked_at !== null || new Date(row.absolute_expires_at).getTime() <= Date.now()
          || new Date(row.last_human_activity_at).getTime() + 30 * 60 * 1000 <= Date.now()) throw new Error('RESTORE_NATIVE_SESSION_EXPIRED');
      const cipher = new SessionCipher(await readFile(join(this.targetPrivate, 'coordinator/session-encryption-key')), await readFile(join(this.targetPrivate, 'coordinator/session-csrf-key')));
      const payload = JSON.parse(cipher.decrypt(String(row.encrypted_oidc_tokens), { cookieHash, subjectId: agency.subject, epoch: BigInt(String(row.epoch)) })) as Record<string, unknown>;
      const origin = 'https://localhost:' + this.env.tlsPort;
      if (payload['acr'] !== '2' || payload['issuer'] !== origin + '/realms/dossiercle' || typeof payload['sid'] !== 'string') throw new Error('RESTORE_NATIVE_MFA_PAYLOAD_REFUSED');
      const entries = await this.inspect(this.targetProject);
      const address = (service: string) => entries.find(entry => entry.Config.Labels['com.docker.compose.service'] === service)?.NetworkSettings.Networks[this.targetProject + '_private']?.IPAddress;
      const kcAddress = address('keycloak'), piAddress = address('privacyidea');
      if (!kcAddress || !piAddress) throw new Error('RESTORE_NATIVE_NAMESPACE_REFUSED');
      const secret = async (path: string) => (await readFile(join(this.targetPrivate, path), 'utf8')).trim();
      const keycloak = new KeycloakAdapter({ transport: { advertisedOrigin: origin, host: kcAddress, port: 8443, serverName: 'keycloak', caFile: join(this.targetPrivate, 'ca/ca.crt') }, callbackOrigin: origin, realm: 'dossiercle', clientId: 's01-bff', clientSecret: await secret('kc/client-s01-bff'), administrativeClientId: 's01-identity', administrativeSecret: await secret('kc/client-s01-identity'), importClientId: 's01-importer', importSecret: await secret('kc/client-s01-importer') });
      if (!await keycloak.sessionPresent(agency.subject, payload['sid'])) throw new Error('RESTORE_NATIVE_SID_NOT_LIVE');
      const user = await keycloak.user(agency.subject), credentials = await keycloak.credentialReadiness(agency.subject);
      const pi = new EnrollmentAdapter({ transport: { advertisedOrigin: 'https://privacyidea:8443', host: piAddress, port: 8443, serverName: 'privacyidea', caFile: join(this.targetPrivate, 'ca/ca.crt') }, verifierPassword: await secret('pi/verifier-password') });
      const proof = await pi.proof(agency.subject, agency.subject);
      if (!user.enabled || user.id !== agency.subject || user.invitationRoot !== agency.root || user.contact !== payload['contact'] || credentials.fingerprint !== payload['credentialFingerprint'] || proof.fingerprint !== payload['piFingerprint']) throw new Error('RESTORE_NATIVE_IDENTITY_CHANGED');
    } finally { await pool.end(); }
  }
  private async assertDumpSecretsAbsent(dump: Buffer) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const materials: Buffer[] = [];
    for (const agency of this.agencies) {
      const bits = [...agency.seed.replace(/=+$/, '')].map(character => alphabet.indexOf(character).toString(2).padStart(5, '0')).join('');
      const raw = Buffer.from((bits.match(/.{8}/g) ?? []).map(value => parseInt(value, 2)));
      materials.push(Buffer.from(agency.seed), raw, Buffer.from(raw.toString('hex')), Buffer.from(raw.toString('hex').toUpperCase()));
    }
    const key = await readFile(join(this.env.private, 'pi/pi-enckey'));
    materials.push(key, Buffer.from(key.toString('hex')), Buffer.from(key.toString('base64')));
    try { if (materials.some(material => material.length > 0 && dump.includes(material))) throw new Error('RESTORE_NATIVE_DUMP_PLAINTEXT_SECRET_REFUSED'); }
    finally { for (const material of materials) material.fill(0); }
    this.record('uncompressed-native-dump-contains-no-enckey-or-totp-seed-forms');
  }
  private async nativePi(agency: Agency, validateOtp = false) {
    const otp = validateOtp ? await (await import('../../../tests/auth/private-otp-fixture.js')).fixtureOtp(agency.seed) : undefined;
    const code = "import base64,json,logging,sys\nlogging.disable(logging.CRITICAL)\nv=json.load(sys.stdin)\nfrom privacyidea.app import create_docker_app\nfrom privacyidea.lib.token import get_tokens\nwith create_docker_app().app_context():\n t=get_tokens(userid=v['subject'],resolver='s01-keycloak',tokentype='totp')\n assert len(t)==1 and t[0].token.serial==v['serial']\n k=t[0].token.get_otpkey().getKey()\n if isinstance(k,str): k=k.encode()\n expected=base64.b32decode(v['seed'])\n assert k in (expected,expected.hex().encode())\n if v['validateOtp']:\n  assert t[0].check_otp(v['otp'])!=-1\n print('NATIVE_PI_REAL_OTP_PASS' if v['validateOtp'] else 'NATIVE_PI_DECRYPT_PASS')";
    const result = await this.compose(true, ['exec', '-T', 'privacyidea', 'python', '-c', code], Buffer.from(JSON.stringify({ subject: agency.subject, serial: agency.serial, seed: agency.seed, validateOtp, ...(validateOtp ? { otp } : {}) })));
    expect(result.toString().trim()).toBe(validateOtp ? 'NATIVE_PI_REAL_OTP_PASS' : 'NATIVE_PI_DECRYPT_PASS');
  }
  private async agencyClient(locator: Locator) {
    const password = await new FileSecretStore(join(this.targetPrivate, 't06-runtime')).read(this.binding(locator, 'runtime'));
    const pool = new Pool({ host: '127.0.0.1', port: this.env.pgPort, database: locator.database_name, user: locator.runtime_role, password: password.toString(), max: 1 });
    password.fill(0); return pool;
  }
  private async tenantCanaries() {
    const repository = new AgencyRepository();
    for (const [index, agency] of this.agencies.entries()) {
      const locator = this.locators.find(row => row.agency_id === agency.id)!;
      const pool = await this.agencyClient(locator), client = await pool.connect();
      try {
        await repository.verify(client, agency.id);
        await repository.verifyRuntimeAcl(client, locator.runtime_role, locator.migration_role);
        expect((await client.query('SELECT current_database() AS database,current_user AS role')).rows).toEqual([{ database: locator.database_name, role: locator.runtime_role }]);
        expect((await client.query('SELECT event_type FROM public.audit_event WHERE event_id=$1', [agency.id])).rows).toEqual([{ event_type: 'synthetic.restore.' + ['A', 'B'][index] }]);
        await expect(repository.verify(client, this.agencies[1 - index]!.id)).rejects.toThrow('AGENCY_SCHEMA_CLOSED');
      } finally { client.release(); await pool.end(); }
      const denied = await this.http(agency, '/v1/agencies/' + this.agencies[1 - index]!.id + '/activation');
      expect(denied.status).toBe(404); expect(denied.body['code']).toBe('NOT_FOUND');
    }
  }
  private async networkIsolation() {
    const name = this.targetProject + '-network-canary', image = this.source.services['privacyidea']!.image;
    const server = "import socket\ns=socket.socket();s.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1);s.bind(('0.0.0.0',15321));s.listen()\nwhile True:\n c,a=s.accept();c.sendall(b'S01_RESTORE_OWNED_CANARY');c.close()";
    await command('OWNED_SOURCE_NETWORK_CANARY', 'docker', ['run', '-d', '--name', name, '--network', project + '_private', '--label', 'dossiercle.restore.owner=' + this.run, '--read-only', '--tmpfs', '/tmp', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--log-driver', 'none', '--restart', 'no', image, 'python', '-u', '-c', server]);
    try {
      const entries = JSON.parse((await command('CANARY_INSPECT', 'docker', ['inspect', name])).toString()) as Inspection[];
      const canary = entries[0];
      if (!canary || canary.Config.Labels['dossiercle.restore.owner'] !== this.run || canary.Mounts.length !== 0 || Object.keys(canary.NetworkSettings.Networks).join(',') !== project + '_private') throw new Error('RESTORE_NETWORK_CANARY_OWNER_REFUSED');
      const ip = canary.NetworkSettings.Networks[project + '_private']!.IPAddress;
      const positive = "import socket,sys,time\nip=sys.argv[1]\nfor n in range(20):\n try:\n  s=socket.create_connection((ip,15321),timeout=1);data=s.recv(64);s.close();assert data==b'S01_RESTORE_OWNED_CANARY';print('SOURCE_CANARY_LIVE');break\n except OSError:\n  if n==19: raise\n  time.sleep(.05)";
      const observed = await command('CANARY_POSITIVE_SOURCE_NAMESPACE', 'docker', ['exec', name, 'python', '-c', positive, ip]);
      expect(observed.toString().trim()).toBe('SOURCE_CANARY_LIVE');
      const negative = "import socket,sys\ntry:\n s=socket.create_connection((sys.argv[1],15321),timeout=2);s.close();raise SystemExit(7)\nexcept OSError: print('SOURCE_CANARY_ISOLATED')";
      const refused = await this.compose(true, ['exec', '-T', 'identity-coordinator', 'python', '-c', negative, ip]);
      expect(refused.toString().trim()).toBe('SOURCE_CANARY_ISOLATED');
      // Reconfirm the same listener after the negative so an exited server cannot explain it.
      expect((await command('CANARY_POSITIVE_AFTER_NEGATIVE', 'docker', ['exec', name, 'python', '-c', positive, ip])).toString().trim()).toBe('SOURCE_CANARY_LIVE');
    } finally {
      const entries = JSON.parse((await command('CANARY_STOP_OWNER', 'docker', ['inspect', name])).toString()) as Inspection[];
      if (entries[0]?.Config.Labels['dossiercle.restore.owner'] !== this.run) throw new Error('RESTORE_CANARY_STOP_REFUSED');
      await command('CANARY_STOP', 'docker', ['stop', '--time', '10', name]);
      const stopped = JSON.parse((await command('CANARY_STOP_INSPECT', 'docker', ['inspect', name])).toString()) as Inspection[];
      if (stopped[0]?.State.Running !== false) throw new Error('RESTORE_CANARY_STOP_UNCONFIRMED');
    }
    this.record('owned-source-live-network-canary-unreachable-from-isolated-target');
  }
  async positiveTarget() {
    await this.networkIsolation();
    const journal = join(root, '.local/journal/application/authority.jsonl'), before = hash(await readFile(journal));
    for (const agency of this.agencies) {
      await this.assertNativeSessionStillValid(agency);
      const session = await this.http(agency, '/v1/session');
      expect(session.status).toBe(200); expect(session.body['scope']).toBe('agency'); expect(session.body['agencyId']).toBe(agency.id);
      const view = await this.http(agency, '/v1/agencies/' + agency.id + '/activation');
      expect(view.status).toBe(200); expect(view.body['state']).toBe('ACTIVE');
      await this.nativePi(agency, true);
    }
    await this.tenantCanaries();
    expect(hash(await readFile(journal))).toBe(before);
    expect(await this.projection(true)).toBe(this.oldProjection);
    this.nativeBaseline = await this.nativeState();
    this.record('positive-api-native-mfa-sid-receipt-canaries-current-journal-unchanged');
  }

  private async baseline() {
    expect(await this.projection(true)).toBe(this.oldProjection);
    expect(await this.nativeState()).toBe(this.nativeBaseline);
    expect(hash(await readFile(join(root, '.local/journal/application/authority.jsonl')))).toBe(this.beforeDenyHead);
    expect((await this.http(this.agencies[0]!, '/v1/session')).status).toBe(200);
  }
  private async perturbFile(path: string, replacement: Uint8Array | undefined, work: () => Promise<void>) {
    const mode = (await lstat(path)).mode & 0o777;
    const retained = path + '.retained-' + randomUUID();
    await rename(path, retained);
    try { if (replacement) await exclusive(path, replacement, mode); await work(); }
    finally {
      if (replacement) await rename(path, path + '.invalid-' + randomUUID());
      await rename(retained, path);
    }
  }
  async negativeMatrix() {
    const agency = this.agencies[0]!, path = join(root, '.local/journal/application/authority.jsonl');
    for (const replacement of [undefined, Buffer.from('{"truncated":')]) {
      await this.perturbFile(path, replacement, async () => {
        const response = await this.http(agency, '/v1/session');
        expect(response.status).toBe(503);
      });
      await this.baseline();
    }
    this.record('missing-and-divergent-journal-fail-closed-baseline-recovered');
    const keyPath = join(this.targetPrivate, 'pi/pi-enckey');
    for (const replacement of [undefined, randomBytes(96)]) {
      await this.perturbFile(keyPath, replacement, async () => {
        await expect(this.nativePi(agency)).rejects.toThrow('RESTORE_COMMAND_FAILED_TARGET_COMPOSE_PYTHON');
        // A fresh native canary process cannot decrypt this ciphertext with no/wrong key.
        await expect(this.compose(true, ['exec', '-T', 'privacyidea', 'python', '/opt/pi-canary.py', 'verify'])).rejects.toThrow('RESTORE_COMMAND_FAILED_TARGET_COMPOSE_PYTHON');
      });
      await this.nativePi(agency); await this.baseline();
    }
    this.record('ciphertext-only-pi-and-missing-wrong-enckey-native-closed');
    for (const locator of this.locators) {
      const binding = this.binding(locator, 'runtime'), store = new FileSecretStore(join(this.targetPrivate, 't06-runtime'));
      const directory = join(this.targetPrivate, 't06-runtime', binding.agencyId);
      const manifest = join(directory, `${binding.secretRef}.v${binding.version}.runtime.json`);
      const original = JSON.parse(await readFile(manifest, 'utf8')) as Record<string, unknown>;
      for (const delta of [{ sha256: '0'.repeat(64) }, { version: binding.version + 1 }, { agencyId: this.agencies.find(value => value.id !== binding.agencyId)!.id }, { unknown: true }]) {
        await this.perturbFile(manifest, Buffer.from(JSON.stringify({ ...original, ...delta })), async () => {
          await expect(store.read(binding)).rejects.toThrow('SECRET_BINDING_DIVERGED');
        });
        const valid = await store.read(binding); valid.fill(0); await this.baseline();
      }
      const secret = join(directory, `${binding.secretRef}.v${binding.version}.runtime.secret`);
      await chmod(secret, 0o600);
      try { await expect(store.read(binding)).rejects.toThrow('SECRET_FILE_REFUSED'); }
      finally { await chmod(secret, 0o400); }
      const valid = await store.read(binding); valid.fill(0);
    }
    await this.locatorSubstitution(); await this.baseline();
    this.record('manifest-version-checksum-owner-foreign-secret-locator-closed');
  }
  private async locatorSubstitution() {
    const first = this.locators[0]!, foreign = this.locators[1]!;
    const substituted = { ...foreign, agency_id: first.agency_id, operation_id: first.operation_id };
    const secrets = new FileSecretStore(join(this.targetPrivate, 't06-runtime'));
    await expect(secrets.read(this.binding(substituted, 'runtime'))).rejects.toThrow();
    const pool = await this.agencyClient(foreign), client = await pool.connect();
    try { await expect(new AgencyRepository().verify(client, first.agency_id)).rejects.toThrow('AGENCY_SCHEMA_CLOSED'); }
    finally { client.release(); await pool.end(); }
    await this.tenantCanaries();
  }

  async denySourceAndRestartTarget() {
    await this.baseline(); await this.stop(true);
    // No CIBLE reader/writer exists while the sole SOURCE repository owns J1 RW.
    this.sourceStarted = true;
    await this.compose(false, ['up', '-d', '--wait', '--wait-timeout', '60', 'postgres']);
    const entries = (await this.inspect(project)).filter(item => item.State.Running);
    expect(entries.map(item => item.Config.Labels['com.docker.compose.service'])).toEqual(['postgres']);
    const pool = await this.db(), journal = new AuthorityJournal(join(root, '.local/journal/application'));
    const repository = new ControlRepository(pool, journal);
    try {
      for (const agency of this.agencies) {
        const commandId = randomUUID();
        // Real lost convergence after journal fsync; SQL rolls back, J1 remains PENDING.
        await expect(repository.deny(agency.subject, commandId, async () => { throw new Error('RESTORE_SYNTHETIC_CONVERGENCE_LOST'); }, { id: agency.subject, type: 'human' })).rejects.toThrow('RESTORE_SYNTHETIC_CONVERGENCE_LOST');
        expect((await journal.head(agency.subject))?.state).toBe('PENDING');
        expect((await pool.query('SELECT status FROM identity.account_authority WHERE subject_id=$1', [agency.subject])).rows[0].status).toBe('CONFIRMED');
        await repository.deny(agency.subject, commandId, async () => {}, { id: agency.subject, type: 'human' });
        await repository.deny(agency.subject, commandId, async () => { throw new Error('RESTORE_DENY_REPLAY_CALLED_CONVERGE'); });
        expect((await journal.head(agency.subject))?.state).toBe('DENIED');
        expect((await journal.head(agency.subject))?.epoch).toBe(2n);
      }
    } finally { await pool.end(); }
    await noOpenJournalWriter(join(root, '.local/journal/application/authority.jsonl'));
    await this.stop(false); await this.startTarget();
    expect(await this.projection(true)).toBe(this.oldProjection);
    expect(await this.nativeState()).toBe(this.nativeBaseline);
    this.record('single-source-real-deny-fsync-sql-rollback-recovery-idempotence');
  }
  async revokedTarget() {
    const current = hash(await readFile(join(root, '.local/journal/application/authority.jsonl')));
    expect(current).not.toBe(this.beforeDenyHead);
    for (const agency of this.agencies) {
      // Native provider is still valid: denial must come from current J1 versus old SQL.
      await this.nativePi(agency); await this.assertNativeSessionStillValid(agency);
      const session = await this.http(agency, '/v1/session'); expect(session.status).toBe(503); expect(session.body['code']).toBe('DEPENDENCY_UNAVAILABLE');
      const view = await this.http(agency, '/v1/agencies/' + agency.id + '/activation'); expect(view.status).toBe(503); expect(view.body['code']).toBe('DEPENDENCY_UNAVAILABLE');
      const activationReplay = await this.http(agency, '/v1/agencies/' + agency.id + '/activation', 'POST', {}, { 'Idempotency-Key': agency.activationKey, 'If-Match': '"' + agency.activationVersion + '"' });
      expect(activationReplay.status).toBe(503); expect(activationReplay.body['code']).toBe('DEPENDENCY_UNAVAILABLE');
      const creationReplay = await this.http(agency, '/v1/agencies', 'POST', { name: agency.name }, { 'Idempotency-Key': agency.createKey });
      expect(creationReplay.status).toBe(503); expect(creationReplay.body['code']).toBe('DEPENDENCY_UNAVAILABLE');
      const retry = await this.http(agency, '/v1/agencies/' + agency.id + '/provisioning/retry', 'POST', {}, { 'Idempotency-Key': randomUUID(), 'If-Match': '"' + agency.activationVersion + '"' });
      expect(retry.status).toBe(503); expect(retry.body['code']).toBe('DEPENDENCY_UNAVAILABLE');
    }
    expect(await this.projection(true)).toBe(this.oldProjection);
    expect(await this.nativeState()).toBe(this.nativeBaseline);
    expect(hash(await readFile(join(root, '.local/journal/application/authority.jsonl')))).toBe(current);
    this.record('old-confirmed-active-projection-cookie-sid-receipt-retry-activation-denied-by-current-journal');
  }
  async receipt() {
    await capacity();
    const pool = await this.db('control_coordinator', 'control', true);
    try {
      const rows = (await pool.query('SELECT state,activated_at IS NOT NULL AS activated FROM control.agency WHERE id=ANY($1::uuid[])', [this.agencies.map(agency => agency.id)])).rows;
      expect(rows).toHaveLength(2); expect(rows.every(row => row.state === 'ACTIVE' && row.activated)).toBe(true);
      const session = (await pool.query('SELECT count(*)::int AS n FROM identity.session WHERE subject_id=ANY($1::uuid[]) AND revoked_at IS NULL', [this.agencies.map(agency => agency.subject)])).rows[0].n as number;
      expect(session).toBeGreaterThanOrEqual(2);
    } finally { await pool.end(); }
    await exclusive(join(this.directory, 'verify.json'), JSON.stringify({ version: 1, root, project, target: this.targetProject, run: this.run, localSyntheticOnly: true, globalQualification: false, canaryAgencies: 2, restoredAgencyStores: this.allLocators.length, checks: this.observations, backupHashes: this.snapshot?.stores.map(store => ({ store: store.name, sha256: store.sha256 })), retained: ['encrypted-backups', 'keys', 'journal', 'source-target-stores'] }));
  }
  async stopOwnedResources() {
    try { if (this.targetStarted) await this.stop(true); }
    finally {
      if (this.sourceStarted) await this.stop(false);
      this.key.fill(0);
      for (const agency of this.agencies) { agency.cookie = ''; agency.seed = ''; agency.csrf = ''; }
      await exclusive(join(this.directory, 'stopped.json'), JSON.stringify({ version: 1, source: !(await this.inspect(project)).some(item => item.State.Running), target: !(await this.inspect(this.targetProject)).some(item => item.State.Running), preserved: true }));
    }
  }
}
