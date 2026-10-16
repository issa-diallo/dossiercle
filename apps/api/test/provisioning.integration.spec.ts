import { readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { createTenantRouter } from '@dossiercle/adapters/postgres/tenant-router-factory';
import { ControlRepository } from '@dossiercle/adapters/postgres/control.repository';
import { describe, it, expect } from 'vitest';
import { ProvisioningService } from '../src/provisioning/provisioning.service.js';
import { FileSecretStore } from '@dossiercle/adapters/secrets/secret-store';
import { AuthorityJournal } from '@dossiercle/adapters/journal/authority-journal';
import { ProvisioningSession } from '@dossiercle/adapters/postgres/provisioning-session';
import { ProvisioningRepository } from '@dossiercle/adapters/postgres/provisioning.repository';
import { createT06Fixture, t06Environment, t06Pool } from './private-t06-fixture.js';
describe('durable T06 provisioning saga', () => {
    it('commits READY with pending ADMIN, stable resources, six durable readbacks and closed gate', async () => {
        const fixture = await createT06Fixture(), e = await t06Environment();
        const pool = await t06Pool('provisioner', 'control', 4), ddl = await t06Pool('provisioner_ddl', 'postgres');
        const central = await t06Pool('control_migrator');
        const service = new ProvisioningService({ pool, ddl, host: '127.0.0.1', port: e.pgPort,
            runtimeSecrets: new FileSecretStore(e.private + '/t06-runtime'),
            migrationSecrets: new FileSecretStore(e.private + '/t06-migration'),
            journal: new AuthorityJournal('.local/journal/application'), instanceId: randomUUID(), allowed: async () => [fixture] });
        try {
            expect(await service.wake(fixture.eventId)).toEqual({ operationId: fixture.operationId, disposition: 'closed' });
            const status = (await central.query(`SELECT a.state,a.activated_at,m.state AS membership,o.step,o.status,
    l.schema_version,l.secret_version,l.verification_version::text,
    (SELECT count(*)::int FROM control.provisioning_effect WHERE operation_id=o.id AND status='CONFIRMED') AS effects
    FROM control.agency a JOIN identity.membership m ON m.agency_id=a.id
    JOIN control.provisioning_operation o ON o.agency_id=a.id
    JOIN control.database_locator l ON l.agency_id=a.id WHERE a.id=$1`, [fixture.agencyId])).rows[0];
            expect(status).toEqual({ state: 'READY', activated_at: null, membership: 'PENDING', step: 'READY', status: 'SUCCEEDED',
                schema_version: 1, secret_version: 1, verification_version: '1', effects: 6 });
            expect((await central.query('SELECT state,execution_id FROM control.provisioning_gate')).rows[0])
                .toEqual({ state: 'IDLE', execution_id: null });
            const locator = (await central.query('SELECT * FROM control.database_locator WHERE agency_id=$1', [fixture.agencyId])).rows[0];
            expect((await service.wake(fixture.eventId)).disposition).toBe('ignored');
            expect((await central.query('SELECT * FROM control.database_locator WHERE agency_id=$1', [fixture.agencyId])).rows[0]).toEqual(locator);
            expect((await central.query(`SELECT count(*)::int AS n FROM control.provisioning_execution
    WHERE operation_id=$1`, [fixture.operationId])).rows[0].n).toBe(1);
            const privateManifest = JSON.parse(await readFile('.local/fixture-manifests/registry.json', 'utf8'));
            expect(privateManifest.t06.some((t: {
                agencyId: string;
            }) => t.agencyId === fixture.agencyId)).toBe(true);
        }
        finally {
            await pool.end();
            await ddl.end();
            await central.end();
        }
    });
    it('rolls back PREPARE atomically before commit without losing or publishing resource references', async () => {
        const fixture = await createT06Fixture(true), pool = await t06Pool('provisioner', 'control', 4);
        const central = await t06Pool('control_migrator');
        const session = (await ProvisioningSession.acquire(pool))!;
        try {
            await session.lockOperation(fixture.operationId);
            const repo = new ProvisioningRepository(session.repositoryPool());
            await expect(repo.prepare({ operationId: fixture.operationId, executionId: randomUUID(), instanceId: randomUUID(),
                actorId: '00000000-0000-4000-8000-000000000074', verifyAuthority: async (scope) => {
                    const head = await new AuthorityJournal('.local/journal/application').head(scope.subject_id);
                    if (head?.hash !== scope.journal_hash)
                        throw new Error('AUTHORITY_CLOSED');
                }, beforeCommit: async () => { throw new Error('INJECTED_PREPARE_ABORT'); } })).rejects.toThrow('INJECTED_PREPARE_ABORT');
            expect((await central.query('SELECT attempt,version::text,status FROM control.provisioning_operation WHERE id=$1', [fixture.operationId])).rows[0])
                .toEqual({ attempt: 0, version: '1', status: 'PENDING' });
            expect((await central.query('SELECT count(*)::int AS n FROM control.provisioning_effect WHERE operation_id=$1', [fixture.operationId])).rows[0].n).toBe(0);
            expect((await central.query('SELECT count(*)::int AS n FROM control.database_locator WHERE agency_id=$1', [fixture.agencyId])).rows[0].n).toBe(0);
            expect((await central.query('SELECT count(*)::int AS n FROM control.provisioning_execution WHERE operation_id=$1', [fixture.operationId])).rows[0].n).toBe(0);
            expect((await central.query('SELECT state FROM control.provisioning_gate')).rows[0].state).toBe('IDLE');
        }
        finally {
            await session.close();
            await pool.end();
            await central.end();
        }
    });
    it('wires human routing to the real central authority and refuses PENDING/READY without granting agency access', async () => {
        const fixture = await createT06Fixture(true), e = await t06Environment();
        const central = await t06Pool('control_migrator'), api = await t06Pool('control_api');
        const pool = await t06Pool('provisioner', 'control', 4), ddl = await t06Pool('provisioner_ddl', 'postgres');
        const journal = new AuthorityJournal('.local/journal/application'), runtimeSecrets = new FileSecretStore(e.private + '/t06-runtime');
        const router = createTenantRouter({ control: api, journal, secrets: runtimeSecrets, host: '127.0.0.1', port: e.pgPort });
        const cookieHash = createHash('sha256').update(randomUUID()).digest('hex');
        const identity = { subjectId: fixture.subjectId, agencyId: fixture.agencyId, sessionEpoch: 1n, sessionCookieHash: cookieHash };
        try {
            await central.query(`INSERT INTO identity.session(cookie_hash,subject_id,scope,invitation_root_id,
    issued_at,last_human_activity_at,absolute_expires_at,epoch,encrypted_oidc_tokens)
    VALUES($1,$2,'onboarding',$3,now(),now(),now()+interval '1 hour',1,'private-synthetic-not-decrypted')`, [cookieHash, fixture.subjectId, fixture.rootId]);
            expect(await new ControlRepository(api, journal).withAuthority(fixture.subjectId, false, async () => true)).toBe(true);
            await expect(router.context(identity)).rejects.toThrow('TENANT_AUTHORIZATION_CLOSED');
            const service = new ProvisioningService({ pool, ddl, host: '127.0.0.1', port: e.pgPort, runtimeSecrets,
                migrationSecrets: new FileSecretStore(e.private + '/t06-migration'), journal, instanceId: randomUUID(), allowed: async () => [fixture] });
            expect((await service.wake(fixture.eventId)).disposition).toBe('closed');
            await expect(router.context(identity)).rejects.toThrow('TENANT_AUTHORIZATION_CLOSED');
            await expect(router.context({ ...identity, sessionEpoch: 2n })).rejects.toThrow('TENANT_AUTHORIZATION_CLOSED');
            expect((await central.query(`SELECT a.state,a.activated_at,m.state AS membership,s.scope
    FROM control.agency a JOIN identity.membership m ON m.agency_id=a.id
    JOIN identity.session s ON s.subject_id=m.subject_id WHERE a.id=$1 AND s.cookie_hash=$2`, [fixture.agencyId, cookieHash])).rows[0]).toEqual({ state: 'READY', activated_at: null, membership: 'PENDING', scope: 'onboarding' });
        }
        finally {
            await router.close();
            await api.end();
            await pool.end();
            await ddl.end();
            await central.end();
        }
    });
});
