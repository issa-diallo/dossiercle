import { createHash, randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from '@dossiercle/adapters/postgres/runtime-pool';
import { ProvisioningSession } from '@dossiercle/adapters/postgres/provisioning-session';
import { ProvisioningAttempt } from '@dossiercle/adapters/postgres/provisioning-attempt';
import { ProvisioningRepository, type ProvisioningScope, type EffectKind, type PreparedProvisioning } from '@dossiercle/adapters/postgres/provisioning.repository';
import { AgencyProvisioner, type AgencyResources } from '@dossiercle/adapters/postgres/agency-provisioner';
import { AgencyRepository } from '@dossiercle/adapters/postgres/agency.repository';
import type { FileSecretStore } from '@dossiercle/adapters/secrets/secret-store';
import type { AuthorityJournal } from '@dossiercle/adapters/journal/authority-journal';
const ACTOR = '00000000-0000-4000-8000-000000000074';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export interface FixtureTuple {
    agencyId: string;
    operationId: string;
    rootId: string;
}
export interface ProvisioningConfiguration {
    pool: Pool;
    ddl: Pool;
    runtimeSecrets: FileSecretStore;
    migrationSecrets: FileSecretStore;
    journal: AuthorityJournal;
    host: string;
    port: number;
    instanceId: string;
    allowed: () => Promise<readonly FixtureTuple[]>;
    onError?: (error: unknown) => void;
    beforeEffect?: (kind: EffectKind | 'FINALIZE') => Promise<void>;
    afterEffect?: (kind: EffectKind) => Promise<void>;
    beforePrepareCommit?: () => Promise<void>;
    beforeLocalAudit?: (client: PoolClient) => Promise<void>;
    afterLocalAuditInsert?: (client: PoolClient) => Promise<void>;
    afterDdlBoundary?: (stage: string) => Promise<void>;
    afterVerification?: (attempt: ProvisioningAttempt, resources: AgencyResources) => Promise<void>;
}
export type WakeResult = {
    operationId: string | null;
    disposition: 'closed' | 'busy' | 'blocked' | 'ignored';
};
/** Only durable event identifiers cross the mTLS boundary. All authority is reloaded. */
export class ProvisioningService {
    constructor(private readonly config: ProvisioningConfiguration) { }
    private async authority(scope: ProvisioningScope): Promise<void> {
        const head = await this.config.journal.head(scope.subject_id);
        if (!head || head.state !== 'CONFIRMED' || head.epoch.toString() !== scope.identity_epoch
            || head.sequence.toString() !== scope.journal_sequence || head.hash !== scope.journal_hash
            || scope.authority_status !== 'CONFIRMED' || scope.confirmed_epoch !== scope.identity_epoch)
            throw new Error('PROVISIONING_AUTHORITY_CLOSED');
    }
    async wake(eventId: string): Promise<WakeResult> {
        if (!uuid.test(eventId))
            throw new Error('PROVISIONING_EVENT_REFUSED');
        const session = await ProvisioningSession.acquire(this.config.pool);
        if (!session)
            return { operationId: null, disposition: 'busy' };
        await session.client.query("SELECT set_config('application_name',$1,false)", [`t06-lock:${this.config.instanceId}`]);
        let operationId: string | null = null;
        let executionId: string | undefined;
        let started = false, emitted = false;
        const repo = new ProvisioningRepository(session.repositoryPool());
        try {
            const event = await this.loadEvent(session, eventId);
            if (!event)
                return { operationId: null, disposition: 'ignored' };
            const scope = await repo.validateEvent(event, s => this.authority(s));
            if (!scope)
                return { operationId: null, disposition: 'ignored' };
            const allowed = await this.config.allowed();
            if (!allowed.some(t => t.operationId === scope.operation_id && t.agencyId === scope.agency_id
                && t.rootId === scope.invitation_root_id))
                return { operationId: null, disposition: 'ignored' };
            operationId = scope.operation_id;
            await session.lockOperation(operationId);
            await session.client.query('SET ROLE control_t06');
            const gate = (await session.client.query('SELECT state FROM control.provisioning_gate')).rows[0];
            await session.client.query('RESET ROLE');
            if (gate?.state !== 'IDLE')
                return { operationId, disposition: 'blocked' };
            executionId = randomUUID();
            const prepared = await repo.prepare({ operationId, executionId, instanceId: this.config.instanceId, actorId: ACTOR, verifyAuthority: async (s) => { await session.verify(); await this.authority(s); },
                ...(this.config.beforePrepareCommit ? { beforeCommit: this.config.beforePrepareCommit } : {}) });
            started = true;
            const attempt = new ProvisioningAttempt(session, operationId, executionId, s => this.authority(s), this.config.pool);
            await this.provision(session, repo, attempt, prepared, () => { emitted = true; });
            await this.config.beforeEffect?.('FINALIZE');
            await repo.finish(operationId, executionId, ACTOR, s => this.authority(s));
            return { operationId, disposition: 'closed' };
        }
        catch (error) {
            this.config.onError?.(error);
            if (started && executionId && !emitted)
                try {
                    await session.verify();
                    await repo.failUnissued({ executionId, operationId: operationId!, actorId: ACTOR, verifyAuthority: async (s) => { await session.verify(); await this.authority(s); } });
                    return { operationId, disposition: 'closed' };
                }
                catch { }
            // A retained gate is the conservative outcome after any unknown external effect.
            // This best effort update does not reconnect or release the durable barrier.
            if (executionId)
                try {
                    session.assertValid();
                    await repo.markBlocked(executionId);
                }
                catch { }
            return { operationId, disposition: executionId ? 'blocked' : 'ignored' };
        }
        finally {
            await session.close();
        }
    }
    private async loadEvent(session: ProvisioningSession, id: string) {
        await session.client.query('SET ROLE control_t06');
        const source = (await session.client.query(`SELECT o.event_id AS id,o.type AS name,
      o.schema_version,o.agency_id,o.resource_id,o.version::text,
      w.expected_operation_version::text,w.target_attempt,w.delivery_round
      FROM control.outbox o LEFT JOIN control.provisioning_wakeup w USING(event_id)
      WHERE o.event_id=$1 AND o.type IN ('agency.creation-accepted','agency.provisioning-wakeup')`, [id])).rows[0];
        await session.client.query('RESET ROLE');
        if (!source)
            return null;
        const data: Record<string, unknown> = { schemaVersion: source.schema_version, agencyId: source.agency_id,
            resourceId: source.resource_id, version: source.version };
        if (source.name === 'agency.provisioning-wakeup')
            Object.assign(data, {
                expectedOperationVersion: source.expected_operation_version,
                targetAttempt: source.target_attempt, deliveryRound: source.delivery_round
            });
        return { id: source.id, name: source.name, data };
    }
    private async evidence(kind: EffectKind, scope: ProvisioningScope, locator: {
        database: string;
        runtimeRole: string;
        migrationRole: string;
        secretRef: string;
        migrationSecretRef: string;
    }) {
        const result: Record<string, string | number | boolean> = { agencyId: scope.agency_id, operationId: scope.operation_id };
        if (kind === 'LOCATOR_RESERVED')
            return { ...result, ...locator };
        let migrationPassword: Buffer | undefined;
        for (const secretKind of ['runtime', 'migration'] as const) {
            const store = secretKind === 'runtime' ? this.config.runtimeSecrets : this.config.migrationSecrets;
            const bytes = await store.read({ agencyId: scope.agency_id, operationId: scope.operation_id,
                secretRef: secretKind === 'runtime' ? locator.secretRef : locator.migrationSecretRef,
                version: 1, kind: secretKind });
            if (secretKind === 'migration')
                migrationPassword = bytes;
            result[`${secretKind}Fingerprint`] = createHash('sha256').update(bytes).digest('hex');
        }
        if (kind !== 'SECRET_PUBLISHED') {
            const db = (await this.config.ddl.query(`SELECT d.oid::text,d.datdba::regrole::text AS owner,
        shobj_description(d.oid,'pg_database') AS tag FROM pg_database d WHERE datname=$1`, [locator.database])).rows[0];
            const roles = (await this.config.ddl.query(`SELECT rolname,oid::text FROM pg_roles
        WHERE rolname=ANY($1::text[])`, [[locator.runtimeRole, locator.migrationRole]])).rows;
            if (!db || db.owner !== locator.migrationRole || roles.length !== 2)
                throw new Error('PROVISIONING_READBACK_REFUSED');
            Object.assign(result, { databaseOid: db.oid, databaseOwner: db.owner, databaseTag: db.tag });
            for (const role of roles)
                result[role.rolname === locator.runtimeRole ? 'runtimeOid' : 'migrationOid'] = role.oid;
        }
        if (['SCHEMA_MIGRATED', 'RUNTIME_ACL', 'AUDIT_CONFIRMED'].includes(kind)) {
            const pool = new Pool({ host: this.config.host, port: this.config.port, database: locator.database,
                user: locator.migrationRole, password: migrationPassword!.toString(), max: 1,
                connectionTimeoutMillis: 2000, statement_timeout: 5000, query_timeout: 5000 });
            try {
                const client = await pool.connect();
                try {
                    await new AgencyRepository().verify(client, scope.agency_id);
                    const marker = (await client.query('SELECT migration_checksum,schema_version FROM agency_metadata WHERE singleton=true')).rows[0];
                    Object.assign(result, { schemaVersion: marker.schema_version, migrationChecksum: marker.migration_checksum });
                    if (kind !== 'SCHEMA_MIGRATED')
                        await new AgencyRepository().verifyRuntimeAcl(client, locator.runtimeRole, locator.migrationRole);
                }
                finally {
                    client.release();
                }
            }
            finally {
                await pool.end();
            }
        }
        return result;
    }
    private async provision(session: ProvisioningSession, repo: ProvisioningRepository, attempt: ProvisioningAttempt, prepared: PreparedProvisioning, onEmission: () => void): Promise<void> {
        const c = session.client, { scope, locator } = prepared;
        const collectEvidence = async (kind: EffectKind) => {
            const evidence = await this.evidence(kind, scope, locator);
            if (kind === 'DATABASE_CREATED') {
                await c.query('SET ROLE control_t06');
                const row = (await c.query("SELECT evidence FROM control.provisioning_effect WHERE operation_id=$1 AND kind='DATABASE_CREATED'", [scope.operation_id])).rows[0];
                await c.query('RESET ROLE');
                if (row?.evidence.creationPrecondition)
                    evidence.creationPrecondition = row.evidence.creationPrecondition;
            }
            return evidence;
        };
        const confirm = async (kind: EffectKind) => repo.confirmEffect({ executionId: attempt.executionId,
            operationId: scope.operation_id, kind, targetVersion: 1, evidence: await collectEvidence(kind),
            verifyAuthority: s => this.authority(s) });
        const provisioner = new AgencyProvisioner(this.config.ddl, this.config.runtimeSecrets, this.config.host, this.config.port, this.config.migrationSecrets, {
            assertAlive: () => session.assertValid(), beforeStatement: () => session.verify(), backend: (client, kind) => attempt.backend(client, kind),
            databaseCreationPrecondition: () => attempt.databaseCreationPrecondition(),
            boundary: stage => this.config.afterDdlBoundary?.(stage) ?? Promise.resolve(),
            run: async (kind, work, phase) => {
                await session.verify();
                await c.query('SET ROLE control_t06');
                const prior = (await c.query(`SELECT status,evidence FROM control.provisioning_effect
            WHERE operation_id=$1 AND kind=$2 AND target_version=1`, [scope.operation_id, kind])).rows[0];
                await c.query('RESET ROLE');
                if (prior?.status === 'CONFIRMED') {
                    const current = await collectEvidence(kind);
                    if (JSON.stringify(Object.entries(prior.evidence).sort()) !== JSON.stringify(Object.entries(current).sort()))
                        throw new Error('PROVISIONING_EFFECT_EVIDENCE_CONFLICT');
                }
                await this.config.beforeEffect?.(kind);
                const result = await attempt.run(kind, async () => { onEmission(); return work(); });
                if (phase === 'ROLES') {
                    await this.config.afterDdlBoundary?.('ROLES_COMMITTED');
                    await repo.recordDatabaseCreationPrecondition({ executionId: attempt.executionId, operationId: scope.operation_id,
                        verifyAuthority: async (s) => { await session.verify(); await this.authority(s); }, inspect: async () => {
                            const roles = (await this.config.ddl.query('SELECT rolname,oid::text FROM pg_roles WHERE rolname=ANY($1::text[])', [[locator.runtimeRole, locator.migrationRole]])).rows;
                            const ownerOid = roles.find(r => r.rolname === locator.migrationRole)?.oid;
                            const runtimeOid = roles.find(r => r.rolname === locator.runtimeRole)?.oid;
                            if (!ownerOid || !runtimeOid)
                                throw new Error('PROVISIONING_ROLE_READBACK_REQUIRED');
                            const db = (await this.config.ddl.query('SELECT 1 FROM pg_database WHERE datname=$1', [locator.database])).rows[0];
                            return { ownerOid, runtimeOid, databaseExists: !!db };
                        } });
                    await this.config.afterDdlBoundary?.('CREATE_PREPARED');
                    return result;
                }
                await this.config.afterEffect?.(kind);
                await confirm(kind);
                const step = kind === 'DATABASE_CREATED' ? 'DATABASE_CREATED' : kind === 'SCHEMA_MIGRATED' ? 'SCHEMA_READY' : kind === 'RUNTIME_ACL' ? 'SECRETS_REFERENCED' : null;
                if (step)
                    await repo.advance({ executionId: attempt.executionId, operationId: scope.operation_id, step, verifyAuthority: s => this.authority(s) });
                return result;
            },
        });
        const resources = await provisioner.prepare({ agencyId: scope.agency_id,
            operationId: scope.operation_id, runtimeSecretRef: locator.secretRef,
            migrationSecretRef: locator.migrationSecretRef, allowSecretCreation: (scope.operation_attempt === 0 && prepared.freshLocator) || prepared.secretNeverIssued,
            assertIntent: () => session.verify(), assertMigrationIntent: () => session.verify() });
        await this.config.beforeEffect?.('AUDIT_CONFIRMED');
        await attempt.run('AUDIT_CONFIRMED', async () => {
            const pool = await provisioner.migrationPool(resources), client = await pool.connect();
            try {
                await attempt.backend(client, 'migration');
                const auditId = (await c.query(`SELECT audit_event_id FROM control.provisioning_effect
          WHERE operation_id=$1 AND kind='AUDIT_CONFIRMED' AND target_version=1`, [scope.operation_id])).rows[0]?.audit_event_id;
                await this.config.beforeLocalAudit?.(client);
                await new AgencyRepository().projectAudit(client, { eventId: auditId,
                    eventType: 'agency.provisioning.verified', version: 1n, correlation: scope.operation_id }, () => this.config.afterLocalAuditInsert?.(client) ?? Promise.resolve());
            }
            finally {
                client.release();
                await pool.end();
            }
            const runtime = new Pool({ host: this.config.host, port: this.config.port, database: resources.database,
                user: resources.runtimeRole, password: resources.runtimePassword.toString(), max: 1,
                connectionTimeoutMillis: 2000, statement_timeout: 5000, query_timeout: 5000 });
            try {
                const client = await runtime.connect();
                try {
                    const identity = (await client.query('SELECT current_database() AS db,current_user AS role')).rows[0];
                    if (identity.db !== resources.database || identity.role !== resources.runtimeRole)
                        throw new Error('PROVISIONING_RUNTIME_SUBSTITUTED');
                    await new AgencyRepository().verify(client, scope.agency_id);
                }
                finally {
                    client.release();
                }
            }
            finally {
                await runtime.end();
            }
        });
        await this.config.afterVerification?.(attempt, resources);
        await this.config.afterEffect?.('AUDIT_CONFIRMED');
        await confirm('AUDIT_CONFIRMED');
        await repo.setSchemaReady({ executionId: attempt.executionId, operationId: scope.operation_id,
            verifyAuthority: async (s) => { await session.verify(); await this.authority(s); } });
    }
}
