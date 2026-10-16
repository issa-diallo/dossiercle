import { writeAudit } from '../audit/audit-writer.js';
import type { Pool } from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import { parseProvisioningEvent, provisioningWakeupData } from '@dossiercle/contracts/provisioning-events';
export interface ProvisioningScope {
    operation_id: string;
    agency_id: string;
    invitation_root_id: string;
    subject_id: string;
    agency_state: string;
    operation_step: string;
    operation_status: string;
    operation_attempt: number;
    operation_version: string;
    wakeup_generation: string;
    identity_epoch: string;
    confirmed_epoch: string | null;
    authority_status: string;
    journal_sequence: string;
    journal_hash: string | null;
    invitation_status: string;
    identity_status: string;
    membership_role: string;
    membership_state: string;
}
export type EffectKind = 'LOCATOR_RESERVED' | 'DATABASE_CREATED' | 'SCHEMA_MIGRATED' | 'RUNTIME_ACL' | 'SECRET_PUBLISHED' | 'AUDIT_CONFIRMED';
export interface ReservedLocator {
    agencyId: string;
    database: string;
    runtimeRole: string;
    migrationRole: string;
    secretRef: string;
    migrationSecretRef: string;
    ownershipTag: string;
}
export interface PreparedProvisioning {
    scope: ProvisioningScope;
    locator: ReservedLocator;
    freshLocator: boolean;
    secretNeverIssued: boolean;
}
export class ProvisioningRepository {
    constructor(private readonly pool: Pick<Pool, 'connect'>) { }
    async validateEvent(event: {
        id: string;
        name: string;
        data: unknown;
    }, verifyAuthority: (scope: ProvisioningScope) => Promise<void>): Promise<ProvisioningScope | null> {
        const parsed = parseProvisioningEvent(event.name, event.data), c = await this.pool.connect();
        try {
            await c.query('BEGIN');
            await c.query('SET LOCAL ROLE control_t06');
            const payload = parsed.data;
            let wakeup: ReturnType<typeof provisioningWakeupData.parse> | undefined;
            let operationId: string | undefined;
            if (parsed.name === 'agency.creation-accepted') {
                const source = (await c.query(`SELECT o.event_id,o.type,o.schema_version,o.agency_id,o.resource_id,o.version::text,a.event_type,a.resource_version::text
          FROM control.outbox o JOIN control.audit_event a USING(event_id) WHERE o.event_id=$1`, [event.id])).rows[0];
                if (!source || source.type !== 'agency.creation-accepted' || source.event_type !== source.type || source.schema_version !== payload.schemaVersion || source.agency_id !== payload.agencyId || source.resource_id !== payload.resourceId || source.version !== payload.version || source.resource_version !== payload.version)
                    throw new Error('PROVISIONING_EVENT_SOURCE_REFUSED');
                operationId = (await c.query('SELECT o.id FROM control.agency a JOIN control.provisioning_operation o ON o.agency_id=a.id WHERE a.id=$1 AND a.invitation_root_id=$2', [payload.agencyId, payload.resourceId])).rows[0]?.id;
            }
            else {
                wakeup = provisioningWakeupData.parse(event.data);
                const source = (await c.query(`SELECT o.event_id,o.type,o.schema_version,o.agency_id,o.resource_id,o.version::text,w.expected_operation_version::text,w.target_attempt,w.delivery_round,w.generation::text
          FROM control.outbox o JOIN control.provisioning_wakeup w USING(event_id) JOIN control.audit_event a USING(event_id) WHERE o.event_id=$1 AND a.event_type=o.type AND a.agency_id=o.agency_id AND a.resource_id=o.resource_id AND a.resource_version=o.version`, [event.id])).rows[0];
                if (!source || source.type !== 'agency.provisioning-wakeup' || source.schema_version !== wakeup.schemaVersion || source.agency_id !== wakeup.agencyId || source.resource_id !== wakeup.resourceId || source.version !== wakeup.version || source.generation !== wakeup.version || source.expected_operation_version !== wakeup.expectedOperationVersion || source.target_attempt !== wakeup.targetAttempt || source.delivery_round !== wakeup.deliveryRound)
                    throw new Error('PROVISIONING_EVENT_SOURCE_REFUSED');
                operationId = source.resource_id;
            }
            if (!operationId)
                throw new Error('PROVISIONING_OPERATION_MISSING');
            const scope = (await c.query<ProvisioningScope>('SELECT * FROM control.lock_provisioning_scope($1)', [operationId])).rows[0];
            if (!scope || scope.agency_id !== payload.agencyId || scope.operation_status === 'SUCCEEDED' || scope.agency_state === 'ACTIVE')
                throw new Error('PROVISIONING_EVENT_STALE');
            if (parsed.name === 'agency.creation-accepted' && (scope.operation_step !== 'ACCEPTED' || scope.operation_status !== 'PENDING' || scope.operation_attempt !== 0)) {
                await c.query('COMMIT');
                return null;
            }
            if (parsed.name === 'agency.provisioning-wakeup' && (scope.operation_version !== wakeup!.expectedOperationVersion || scope.operation_attempt + 1 !== wakeup!.targetAttempt || scope.wakeup_generation !== wakeup!.version)) {
                await c.query('COMMIT');
                return null;
            }
            await verifyAuthority(scope);
            await c.query('COMMIT');
            return scope;
        }
        catch (e) {
            await c.query('ROLLBACK');
            throw e;
        }
        finally {
            c.release();
        }
    }
    /** PREPARE is one central commit. No external capability is usable before it returns. */
    async prepare(input: {
        operationId: string;
        executionId: string;
        instanceId: string;
        actorId: string;
        verifyAuthority: (scope: ProvisioningScope) => Promise<void>;
        beforeCommit?: () => Promise<void>;
    }): Promise<PreparedProvisioning> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('SET LOCAL ROLE control_t06');
            const scope = (await client.query<ProvisioningScope>('SELECT * FROM control.lock_provisioning_scope($1)', [input.operationId])).rows[0];
            if (!scope || !['PROVISIONING', 'FAILED'].includes(scope.agency_state)
                || !['PENDING', 'FAILED'].includes(scope.operation_status) || scope.operation_attempt >= 4
                || scope.invitation_status !== 'CLAIMED' || scope.identity_status !== 'CONFIRMED'
                || scope.authority_status !== 'CONFIRMED' || scope.confirmed_epoch !== scope.identity_epoch
                || scope.membership_role !== 'ADMIN' || scope.membership_state !== 'PENDING')
                throw new Error('PROVISIONING_AUTHORITY_CLOSED');
            await input.verifyAuthority(scope);
            const gate = (await client.query('SELECT execution_id,state FROM control.provisioning_gate WHERE singleton=true FOR UPDATE')).rows[0];
            if (!gate || gate.state !== 'IDLE' || gate.execution_id !== null)
                throw new Error('PROVISIONING_GATE_BUSY');
            const old = (await client.query('SELECT * FROM control.database_locator WHERE agency_id=$1 FOR UPDATE', [scope.agency_id])).rows[0];
            const compact = scope.agency_id.replaceAll('-', '');
            const locator: ReservedLocator = { agencyId: scope.agency_id, database: `ag_${compact}`,
                runtimeRole: `agr_${compact}`, migrationRole: `agm_${compact}`, secretRef: old?.secret_ref ?? randomUUID(),
                migrationSecretRef: old?.migration_secret_ref ?? randomUUID(),
                ownershipTag: createHash('sha256').update(`s01:t06:${scope.agency_id}:${input.operationId}:v1`).digest('hex') };
            if (old && (old.database_name !== locator.database || old.runtime_role !== locator.runtimeRole
                || old.migration_role !== locator.migrationRole || old.ownership_tag !== locator.ownershipTag
                || old.secret_version !== 1 || !old.secret_ref || !old.migration_secret_ref))
                throw new Error('PROVISIONING_LOCATOR_CONFLICT');
            await client.query(`INSERT INTO control.provisioning_execution(execution_id,operation_id,instance_id,state)
        VALUES($1,$2,$3,'RUNNING')`, [input.executionId, input.operationId, input.instanceId]);
            await client.query("UPDATE control.provisioning_gate SET execution_id=$1,state='RUNNING',version=version+1,updated_at=clock_timestamp() WHERE singleton=true", [input.executionId]);
            const operation = await client.query(`UPDATE control.provisioning_operation SET status='RUNNING',attempt=attempt+1,
        version=version+1,retryable=false WHERE id=$1 AND version=$2
        AND (status='PENDING' OR (status='FAILED' AND retryable))`, [input.operationId, scope.operation_version]);
            if (operation.rowCount !== 1)
                throw new Error('PROVISIONING_OPERATION_RACE');
            await client.query("UPDATE control.agency SET state='PROVISIONING',version=version+1 WHERE id=$1 AND state='FAILED'", [scope.agency_id]);
            if (!old)
                await client.query(`INSERT INTO control.database_locator(agency_id,database_name,runtime_role,migration_role,
        schema_version,secret_ref,verification_version,secret_version,migration_secret_ref,ownership_tag)
        VALUES($1,$2,$3,$4,0,$5,0,1,$6,$7)`, [scope.agency_id, locator.database, locator.runtimeRole,
                    locator.migrationRole, locator.secretRef, locator.migrationSecretRef, locator.ownershipTag]);
            for (const kind of ['LOCATOR_RESERVED', 'SECRET_PUBLISHED', 'DATABASE_CREATED', 'SCHEMA_MIGRATED', 'RUNTIME_ACL', 'AUDIT_CONFIRMED'] as const) {
                const intention = kind === 'LOCATOR_RESERVED' ? locator : { kind, ...locator };
                const fingerprint = createHash('sha256').update(JSON.stringify(intention)).digest('hex');
                const auditId = randomUUID();
                const added = await client.query(`INSERT INTO control.provisioning_effect(effect_id,operation_id,kind,target_version,
          status,expected_fingerprint,evidence,audit_event_id) VALUES($1,$2,$3,1,'PLANNED',$4,'{}'::jsonb,$5)
          ON CONFLICT(operation_id,kind,target_version) DO NOTHING`, [randomUUID(), input.operationId, kind, fingerprint, auditId]);
                const effect = (await client.query(`SELECT expected_fingerprint,status FROM control.provisioning_effect
          WHERE operation_id=$1 AND kind=$2 AND target_version=1 FOR UPDATE`, [input.operationId, kind])).rows[0];
                if (!effect || effect.expected_fingerprint !== fingerprint || effect.status === 'UNCERTAIN')
                    throw new Error('PROVISIONING_EFFECT_DIVERGED');
                if (added.rowCount)
                    await writeAudit(client, { eventId: auditId, agencyId: null, actorId: input.actorId,
                        actorType: 'service', eventType: 'provisioning.effect.planned', resourceId: input.operationId, version: 1n,
                        outcome: 'accepted', correlation: input.operationId, dispatch: false }, 'control_audit');
            }
            await client.query(`UPDATE control.provisioning_effect SET status='CONFIRMED',evidence=$2::jsonb
        WHERE operation_id=$1 AND kind='LOCATOR_RESERVED' AND status='PLANNED'`, [input.operationId, JSON.stringify({ ...locator, operationId: input.operationId })]);
            const unissued = (await client.query(`SELECT evidence->>'neverIssued' AS unissued FROM control.provisioning_effect
        WHERE operation_id=$1 AND kind='SECRET_PUBLISHED' AND status='PLANNED'`, [input.operationId])).rows[0];
            await writeAudit(client, { eventId: randomUUID(), agencyId: scope.agency_id, actorId: input.actorId,
                actorType: 'service', eventType: 'agency.provisioning.started', resourceId: scope.agency_id,
                version: BigInt(scope.operation_version) + 1n, outcome: 'accepted', correlation: input.operationId, dispatch: false }, 'control_audit');
            await input.beforeCommit?.();
            await client.query('COMMIT');
            return { scope, locator, freshLocator: !old, secretNeverIssued: unissued?.unissued === 'true' };
        }
        catch (error) {
            await client.query('ROLLBACK').catch(() => { });
            throw error;
        }
        finally {
            client.release();
        }
    }
    /** Durable CREATE precondition. The roles effect has ended; no DB CREATE has started. */
    async recordDatabaseCreationPrecondition(input: {
        executionId: string;
        operationId: string;
        verifyAuthority: (scope: ProvisioningScope) => Promise<void>;
        inspect: () => Promise<{
            ownerOid: string;
            runtimeOid: string;
            databaseExists: boolean;
        }>;
    }): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('SET LOCAL ROLE control_t06');
            const scope = (await client.query<ProvisioningScope>('SELECT * FROM control.lock_provisioning_scope($1)', [input.operationId])).rows[0];
            if (!scope || scope.operation_status !== 'RUNNING' || scope.agency_state !== 'PROVISIONING'
                || scope.membership_state !== 'PENDING' || scope.membership_role !== 'ADMIN')
                throw new Error('PROVISIONING_SCOPE_DIVERGED');
            await input.verifyAuthority(scope);
            const gate = (await client.query(`SELECT 1 FROM control.provisioning_gate WHERE singleton=true
        AND state='RUNNING' AND execution_id=$1 FOR UPDATE`, [input.executionId])).rows[0];
            const effect = (await client.query(`SELECT effect_id,status,evidence FROM control.provisioning_effect
        WHERE operation_id=$1 AND kind='DATABASE_CREATED' AND target_version=1 FOR UPDATE`, [input.operationId])).rows[0];
            if (!gate || !effect)
                throw new Error('PROVISIONING_INTENT_REQUIRED');
            const actual = await input.inspect();
            const proof = JSON.stringify({ agencyId: scope.agency_id, operationId: input.operationId, targetVersion: 1,
                databaseAbsent: true, ownerOid: actual.ownerOid, runtimeOid: actual.runtimeOid });
            const previous = effect.evidence.creationPrecondition;
            if (previous !== undefined && previous !== proof)
                throw new Error('PROVISIONING_CREATE_PRECONDITION_DIVERGED');
            if (previous === undefined && !actual.databaseExists) {
                if (effect.status !== 'PLANNED')
                    throw new Error('PROVISIONING_CREATE_PRECONDITION_LATE');
                await client.query(`UPDATE control.provisioning_effect SET evidence=evidence || jsonb_build_object(
          'creationPrecondition',$2::text),updated_at=clock_timestamp() WHERE effect_id=$1`, [effect.effect_id, proof]);
            }
            await input.verifyAuthority(scope);
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK').catch(() => { });
            throw error;
        }
        finally {
            client.release();
        }
    }
    async confirmEffect(input: {
        executionId: string;
        operationId: string;
        kind: EffectKind;
        targetVersion: number;
        evidence: Record<string, string | number | boolean>;
        verifyAuthority: (scope: ProvisioningScope) => Promise<void>;
    }): Promise<void> {
        const c = await this.pool.connect();
        try {
            await c.query('BEGIN');
            await c.query('SET LOCAL ROLE control_t06');
            const scope = (await c.query<ProvisioningScope>('SELECT * FROM control.lock_provisioning_scope($1)', [input.operationId])).rows[0];
            if (!scope || scope.operation_status !== 'RUNNING' || scope.agency_state !== 'PROVISIONING' || scope.authority_status !== 'CONFIRMED' || scope.confirmed_epoch !== scope.identity_epoch || scope.membership_state !== 'PENDING')
                throw new Error('PROVISIONING_AUTHORITY_CLOSED');
            await input.verifyAuthority(scope);
            const gate = (await c.query("SELECT 1 FROM control.provisioning_gate WHERE singleton=true AND state='RUNNING' AND execution_id=$1 FOR UPDATE", [input.executionId])).rows[0];
            const effect = (await c.query(`SELECT effect_id,status FROM control.provisioning_effect WHERE operation_id=$1 AND kind=$2 AND target_version=$3 FOR UPDATE`, [input.operationId, input.kind, input.targetVersion])).rows[0];
            if (!gate || !effect || !['PLANNED', 'CONFIRMED'].includes(effect.status))
                throw new Error('PROVISIONING_EFFECT_MISSING');
            const serialized = JSON.stringify(input.evidence);
            if (effect.status === 'CONFIRMED') {
                const current = (await c.query('SELECT evidence FROM control.provisioning_effect WHERE effect_id=$1', [effect.effect_id])).rows[0]?.evidence;
                if (JSON.stringify(Object.entries(current).sort()) !== JSON.stringify(Object.entries(input.evidence).sort()))
                    throw new Error('PROVISIONING_EFFECT_EVIDENCE_CONFLICT');
            }
            else
                await c.query("UPDATE control.provisioning_effect SET status='CONFIRMED',evidence=$2::jsonb,updated_at=clock_timestamp() WHERE effect_id=$1", [effect.effect_id, serialized]);
            await c.query('COMMIT');
        }
        catch (e) {
            await c.query('ROLLBACK');
            throw e;
        }
        finally {
            c.release();
        }
    }
    async advance(input: {
        executionId: string;
        operationId: string;
        step: 'DATABASE_CREATED' | 'SCHEMA_READY' | 'SECRETS_REFERENCED';
        verifyAuthority: (scope: ProvisioningScope) => Promise<void>;
    }): Promise<void> {
        const c = await this.pool.connect();
        try {
            await c.query('BEGIN');
            await c.query('SET LOCAL ROLE control_t06');
            const scope = (await c.query<ProvisioningScope>('SELECT * FROM control.lock_provisioning_scope($1)', [input.operationId])).rows[0];
            if (!scope || scope.operation_status !== 'RUNNING' || scope.agency_state !== 'PROVISIONING')
                throw new Error('PROVISIONING_SCOPE_DIVERGED');
            await input.verifyAuthority(scope);
            const gate = (await c.query("SELECT 1 FROM control.provisioning_gate WHERE singleton=true AND state='RUNNING' AND execution_id=$1 FOR UPDATE", [input.executionId])).rows[0];
            if (!gate)
                throw new Error('PROVISIONING_EXECUTION_CLOSED');
            const requiredEffect = input.step === 'DATABASE_CREATED' ? 'DATABASE_CREATED' : input.step === 'SCHEMA_READY' ? 'SCHEMA_MIGRATED' : 'SECRET_PUBLISHED';
            const effect = (await c.query('SELECT 1 FROM control.provisioning_effect WHERE operation_id=$1 AND kind=$2 AND target_version=1 AND status=\'CONFIRMED\'', [input.operationId, requiredEffect])).rows[0];
            if (!effect)
                throw new Error('PROVISIONING_CHECKPOINT_WITHOUT_EFFECT');
            const order = ['ACCEPTED', 'DATABASE_CREATED', 'SCHEMA_READY', 'SECRETS_REFERENCED'];
            if (order.indexOf(scope.operation_step) >= order.indexOf(input.step)) {
                await c.query('COMMIT');
                return;
            }
            const prior: {
                ACCEPTED: string;
                DATABASE_CREATED: string;
                SCHEMA_READY: string;
                SECRETS_REFERENCED: string;
            } = { ACCEPTED: 'DATABASE_CREATED', DATABASE_CREATED: 'SCHEMA_READY', SCHEMA_READY: 'SECRETS_REFERENCED', SECRETS_REFERENCED: 'SECRETS_REFERENCED' };
            const changed = await c.query('UPDATE control.provisioning_operation SET step=$2,version=version+1 WHERE id=$1 AND step=$3 AND status=\'RUNNING\'', [input.operationId, input.step, Object.keys(prior).find(k => prior[k as keyof typeof prior] === input.step)]);
            if (changed.rowCount !== 1)
                throw new Error('PROVISIONING_STEP_RACE');
            await c.query('COMMIT');
        }
        catch (e) {
            await c.query('ROLLBACK');
            throw e;
        }
        finally {
            c.release();
        }
    }
    async setSchemaReady(input: {
        executionId: string;
        operationId: string;
        verifyAuthority: (scope: ProvisioningScope) => Promise<void>;
    }): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('SET LOCAL ROLE control_t06');
            const scope = (await client.query<ProvisioningScope>('SELECT * FROM control.lock_provisioning_scope($1)', [input.operationId])).rows[0];
            if (!scope || scope.operation_status !== 'RUNNING' || scope.agency_state !== 'PROVISIONING')
                throw new Error('PROVISIONING_SCOPE_DIVERGED');
            await input.verifyAuthority(scope);
            const gate = (await client.query(`SELECT 1 FROM control.provisioning_gate
        WHERE singleton=true AND state='RUNNING' AND execution_id=$1 FOR UPDATE`, [input.executionId])).rows[0];
            const execution = (await client.query(`SELECT 1 FROM control.provisioning_execution
        WHERE execution_id=$1 AND operation_id=$2 AND state='RUNNING'`, [input.executionId, input.operationId])).rows[0];
            const effect = (await client.query(`SELECT 1 FROM control.provisioning_effect
        WHERE operation_id=$1 AND kind='SCHEMA_MIGRATED' AND target_version=1
          AND status='CONFIRMED'`, [input.operationId])).rows[0];
            if (!gate || !execution || !effect)
                throw new Error('PROVISIONING_EVIDENCE_INCOMPLETE');
            await client.query('UPDATE control.database_locator SET schema_version=1 WHERE agency_id=$1', [scope.agency_id]);
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async failUnissued(input: {
        executionId: string;
        operationId: string;
        actorId: string;
        verifyAuthority: (scope: ProvisioningScope) => Promise<void>;
    }): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('SET LOCAL ROLE control_t06');
            const scope = (await client.query<ProvisioningScope>('SELECT * FROM control.lock_provisioning_scope($1)', [input.operationId])).rows[0];
            if (!scope || scope.operation_status !== 'RUNNING')
                throw new Error('PROVISIONING_SCOPE_DIVERGED');
            await input.verifyAuthority(scope);
            const gate = (await client.query(`SELECT 1 FROM control.provisioning_gate
        WHERE singleton=true AND state='RUNNING' AND execution_id=$1 FOR UPDATE`, [input.executionId])).rows[0];
            const ex = (await client.query(`SELECT backends FROM control.provisioning_execution
        WHERE execution_id=$1 AND operation_id=$2 AND state='RUNNING' FOR UPDATE`, [input.executionId, input.operationId])).rows[0];
            const issued = (await client.query(`SELECT 1 FROM control.provisioning_effect WHERE operation_id=$1
        AND kind<>'LOCATOR_RESERVED' AND status<>'PLANNED' LIMIT 1`, [input.operationId])).rows[0];
            const complete = (await client.query(`SELECT count(*)::int AS n,
        count(*) FILTER(WHERE kind='LOCATOR_RESERVED' AND status='CONFIRMED')::int AS reserved
        FROM control.provisioning_effect WHERE operation_id=$1 AND target_version=1`, [input.operationId])).rows[0];
            const locator = (await client.query(`SELECT * FROM control.database_locator WHERE agency_id=$1`, [scope.agency_id])).rows[0];
            const compact = scope.agency_id.replaceAll('-', '');
            const tag = createHash('sha256').update(`s01:t06:${scope.agency_id}:${input.operationId}:v1`).digest('hex');
            if (!gate || !ex || ex.backends.length || issued || complete?.n !== 6 || complete.reserved !== 1 || !locator
                || locator.database_name !== `ag_${compact}` || locator.runtime_role !== `agr_${compact}`
                || locator.migration_role !== `agm_${compact}` || locator.secret_version !== 1
                || locator.schema_version !== 0 || BigInt(locator.verification_version) !== 0n || locator.ownership_tag !== tag
                || !locator.secret_ref || !locator.migration_secret_ref)
                throw new Error('PROVISIONING_EMISSION_UNCERTAIN');
            await client.query(`UPDATE control.provisioning_effect SET evidence='{"neverIssued":true}'::jsonb
        WHERE operation_id=$1 AND kind='SECRET_PUBLISHED' AND status='PLANNED'`, [input.operationId]);
            await client.query("UPDATE control.agency SET state='FAILED',version=version+1 WHERE id=$1", [scope.agency_id]);
            await client.query(`UPDATE control.provisioning_operation SET status='FAILED',last_error_code='DEPENDENCY_UNAVAILABLE',
        retryable=(attempt<4),version=version+1 WHERE id=$1`, [input.operationId]);
            await writeAudit(client, { eventId: randomUUID(), agencyId: scope.agency_id, actorId: input.actorId,
                actorType: 'service', eventType: 'agency.provisioning.failed-unissued', resourceId: input.operationId,
                version: BigInt(scope.operation_version) + 1n, outcome: 'denied', correlation: input.operationId, dispatch: false }, 'control_audit');
            await client.query("UPDATE control.provisioning_execution SET state='CLOSED',closed_at=clock_timestamp() WHERE execution_id=$1", [input.executionId]);
            await client.query("UPDATE control.provisioning_gate SET state='IDLE',execution_id=NULL,version=version+1 WHERE singleton=true", []);
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async markBlocked(executionId: string): Promise<void> {
        const c = await this.pool.connect();
        try {
            await c.query('BEGIN');
            await c.query('SET LOCAL ROLE control_t06');
            const ex = await c.query("UPDATE control.provisioning_execution SET state='BLOCKED' WHERE execution_id=$1 AND state='RUNNING'", [executionId]);
            const gate = await c.query("UPDATE control.provisioning_gate SET state='BLOCKED',version=version+1,updated_at=clock_timestamp() WHERE execution_id=$1 AND state='RUNNING'", [executionId]);
            if (ex.rowCount !== 1 || gate.rowCount !== 1)
                throw new Error('PROVISIONING_FENCE_MISSING');
            await c.query('COMMIT');
        }
        catch (e) {
            await c.query('ROLLBACK');
            throw e;
        }
        finally {
            c.release();
        }
    }
    async finish(operationId: string, executionId: string, actorId: string, verifyAuthority: (scope: ProvisioningScope) => Promise<void>): Promise<void> {
        const c = await this.pool.connect();
        try {
            await c.query('BEGIN');
            await c.query('SET LOCAL ROLE control_t06');
            const scope = (await c.query<ProvisioningScope>('SELECT * FROM control.lock_provisioning_scope($1)', [operationId])).rows[0];
            if (!scope || scope.operation_status !== 'RUNNING' || scope.agency_state !== 'PROVISIONING' || scope.membership_state !== 'PENDING' || scope.membership_role !== 'ADMIN' || scope.authority_status !== 'CONFIRMED' || scope.confirmed_epoch !== scope.identity_epoch)
                throw new Error('PROVISIONING_AUTHORITY_CLOSED');
            await verifyAuthority(scope);
            const gate = (await c.query("SELECT 1 FROM control.provisioning_gate WHERE singleton=true AND state='RUNNING' AND execution_id=$1 FOR UPDATE", [executionId])).rows[0];
            const execution = (await c.query("SELECT 1 FROM control.provisioning_execution WHERE execution_id=$1 AND operation_id=$2 AND state='RUNNING'", [executionId, operationId])).rows[0];
            const effects = (await c.query("SELECT count(*)::int AS n FROM control.provisioning_effect WHERE operation_id=$1 AND status='CONFIRMED' AND target_version=1 AND kind=ANY($2::text[])", [operationId, ['LOCATOR_RESERVED', 'DATABASE_CREATED', 'SCHEMA_MIGRATED', 'RUNTIME_ACL', 'SECRET_PUBLISHED', 'AUDIT_CONFIRMED']])).rows[0]?.n;
            const locator = (await c.query("SELECT schema_version,secret_version,verification_version,ownership_tag FROM control.database_locator WHERE agency_id=$1", [scope.agency_id])).rows[0];
            if (!gate || !execution || effects !== 6 || !locator || locator.schema_version !== 1 || locator.secret_version === null || locator.ownership_tag === null)
                throw new Error('PROVISIONING_EVIDENCE_INCOMPLETE');
            const updated = await c.query("UPDATE control.database_locator SET verification_version=secret_version WHERE agency_id=$1 AND schema_version=1 AND secret_version IS NOT NULL", [scope.agency_id]);
            if (updated.rowCount !== 1)
                throw new Error('PROVISIONING_LOCATOR_DIVERGED');
            const agency = await c.query("UPDATE control.agency SET state='READY',ready_schema_version=1,version=version+1 WHERE id=$1 AND state='PROVISIONING' AND activated_at IS NULL", [scope.agency_id]);
            const operation = await c.query("UPDATE control.provisioning_operation SET step='READY',status='SUCCEEDED',retryable=false,version=version+1 WHERE id=$1 AND status='RUNNING'", [operationId]);
            if (agency.rowCount !== 1 || operation.rowCount !== 1)
                throw new Error('PROVISIONING_FINALIZE_RACE');
            await writeAudit(c, { eventId: randomUUID(), agencyId: scope.agency_id, actorId, actorType: 'service', eventType: 'agency.provisioning.ready', resourceId: scope.agency_id, version: BigInt(scope.operation_version) + 2n, outcome: 'succeeded', correlation: operationId, dispatch: false }, 'control_audit');
            await c.query("UPDATE control.provisioning_execution SET state='CLOSED',closed_at=clock_timestamp() WHERE execution_id=$1 AND state='RUNNING'", [executionId]);
            await c.query("UPDATE control.provisioning_gate SET state='IDLE',execution_id=NULL,version=version+1,updated_at=clock_timestamp() WHERE singleton=true AND execution_id=$1 AND state='RUNNING'", [executionId]);
            await c.query('COMMIT');
        }
        catch (e) {
            await c.query('ROLLBACK');
            throw e;
        }
        finally {
            c.release();
        }
    }
}
