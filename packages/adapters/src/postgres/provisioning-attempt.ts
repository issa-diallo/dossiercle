import type { Pool, PoolClient } from 'pg';
import type { ProvisioningSession } from './provisioning-session.js';
import type { EffectKind, ProvisioningScope } from './provisioning.repository.js';
declare const verificationBrand: unique symbol;
export type TenantVerificationContext = {
    readonly [verificationBrand]: true;
};
const verificationContexts = new WeakMap<TenantVerificationContext, {
    agencyId: string;
    check: () => Promise<void>;
    run: <T>(work: () => Promise<T>) => Promise<T>;
}>();
export async function verificationAgency(context: TenantVerificationContext): Promise<string> {
    const bound = verificationContexts.get(context);
    if (!bound)
        throw new Error('TENANT_CONTEXT_REFUSED');
    await bound.check();
    return bound.agencyId;
}
export async function withVerificationAuthority<T>(context: TenantVerificationContext, work: (agencyId: string) => Promise<T>): Promise<T> {
    const bound = verificationContexts.get(context);
    if (!bound)
        throw new Error('TENANT_CONTEXT_REFUSED');
    return bound.run(() => work(bound.agencyId));
}
export type AuthorityCheck = (scope: ProvisioningScope) => Promise<void>;
/** Row barriers cover the external effect; durable intents are committed separately first. */
export class ProvisioningAttempt {
    private active = false;
    private accepting = false;
    private generation = 0;
    private readonly verificationFailures: unknown[] = [];
    private readonly verificationTasks = new Set<Promise<unknown>>();
    constructor(private readonly session: ProvisioningSession, readonly operationId: string, readonly executionId: string, private readonly verifyAuthority: AuthorityCheck, private readonly inventory: Pool) { }
    async run<T>(kind: EffectKind, work: () => Promise<T>): Promise<T> {
        if (this.active)
            throw new Error('PROVISIONING_NESTED_EFFECT_REFUSED');
        const client = this.session.client;
        await this.session.verify();
        await client.query('BEGIN');
        try {
            await client.query('SET LOCAL ROLE control_t06');
            const scope = (await client.query<ProvisioningScope>('SELECT * FROM control.lock_provisioning_scope($1)', [this.operationId])).rows[0];
            if (!scope || scope.operation_status !== 'RUNNING' || scope.agency_state !== 'PROVISIONING'
                || scope.invitation_status !== 'CLAIMED' || scope.identity_status !== 'CONFIRMED'
                || scope.membership_role !== 'ADMIN' || scope.membership_state !== 'PENDING'
                || scope.authority_status !== 'CONFIRMED' || scope.confirmed_epoch !== scope.identity_epoch)
                throw new Error('PROVISIONING_AUTHORITY_CLOSED');
            await this.verifyAuthority(scope);
            const gate = (await client.query(`SELECT 1 FROM control.provisioning_gate
        WHERE singleton=true AND state='RUNNING' AND execution_id=$1 FOR UPDATE`, [this.executionId])).rows[0];
            const intent = (await client.query(`SELECT 1 FROM control.provisioning_effect
        WHERE operation_id=$1 AND kind=$2 AND target_version=1
          AND status IN ('PLANNED','CONFIRMED') FOR UPDATE`, [this.operationId, kind])).rows[0];
            if (!gate || !intent)
                throw new Error('PROVISIONING_INTENT_REQUIRED');
            await this.session.verify();
            this.active = true;
            this.accepting = true;
            this.generation++;
            this.verificationFailures.length = 0;
            const result = await work();
            this.accepting = false;
            await this.drainVerification();
            await this.session.verify();
            await this.verifyAuthority(scope);
            this.active = false;
            await client.query('COMMIT');
            return result;
        }
        catch (error) {
            this.accepting = false;
            await this.drainVerification().catch(() => { });
            this.active = false;
            await client.query('ROLLBACK').catch(() => { });
            throw error;
        }
        finally {
            this.active = false;
            this.accepting = false;
        }
    }
    async verificationContext(): Promise<TenantVerificationContext> {
        if (!this.active || !this.accepting)
            throw new Error('TENANT_VERIFICATION_CLOSED');
        const current = (await this.session.client.query<ProvisioningScope>('SELECT * FROM control.lock_provisioning_scope($1)', [this.operationId])).rows[0];
        if (!current)
            throw new Error('TENANT_VERIFICATION_CLOSED');
        const agencyId = current.agency_id, generation = this.generation;
        const check = async () => {
            if (!this.active || this.generation !== generation)
                throw new Error('TENANT_VERIFICATION_CLOSED');
            await this.session.verify();
            const scope = (await this.session.client.query<ProvisioningScope>('SELECT * FROM control.lock_provisioning_scope($1)', [this.operationId])).rows[0];
            const gate = (await this.session.client.query(`SELECT 1 FROM control.provisioning_gate
        WHERE singleton=true AND state='RUNNING' AND execution_id=$1`, [this.executionId])).rows[0];
            if (!scope || scope.agency_id !== agencyId || scope.agency_state !== 'PROVISIONING'
                || scope.operation_status !== 'RUNNING' || scope.membership_state !== 'PENDING' || !gate)
                throw new Error('TENANT_VERIFICATION_CLOSED');
            await this.verifyAuthority(scope);
        };
        await check();
        if (!this.accepting || this.generation !== generation)
            throw new Error('TENANT_VERIFICATION_CLOSED');
        const token = Object.freeze({}) as TenantVerificationContext;
        verificationContexts.set(token, { agencyId, check, run: work => {
                if (!this.active || !this.accepting || this.generation !== generation)
                    return Promise.reject(new Error('TENANT_VERIFICATION_CLOSED'));
                // Register the complete lifetime before the first await, including authority checks.
                const task = Promise.resolve().then(async () => { await check(); return work(); });
                this.verificationTasks.add(task);
                void task.then(() => this.verificationTasks.delete(task), error => {
                    this.verificationFailures.push(error);
                    this.verificationTasks.delete(task);
                });
                return task;
            } });
        return token;
    }
    async databaseCreationPrecondition(): Promise<{
        ownerOid: string;
        runtimeOid: string;
    }> {
        if (!this.active)
            throw new Error('PROVISIONING_CREATE_PRECONDITION_CLOSED');
        await this.session.verify();
        const effect = (await this.session.client.query(`SELECT evidence FROM control.provisioning_effect
      WHERE operation_id=$1 AND kind='DATABASE_CREATED' AND target_version=1 AND status='PLANNED'`, [this.operationId])).rows[0];
        const proof = JSON.parse(effect?.evidence?.creationPrecondition ?? 'null');
        if (!proof || proof.operationId !== this.operationId || proof.targetVersion !== 1 || proof.databaseAbsent !== true
            || !/^\d+$/.test(proof.ownerOid) || !/^\d+$/.test(proof.runtimeOid))
            throw new Error('PROVISIONING_CREATE_PRECONDITION_REQUIRED');
        const scope = (await this.session.client.query<ProvisioningScope>('SELECT * FROM control.lock_provisioning_scope($1)', [this.operationId])).rows[0];
        if (!scope || scope.agency_id !== proof.agencyId)
            throw new Error('PROVISIONING_CREATE_PRECONDITION_DIVERGED');
        await this.verifyAuthority(scope);
        return { ownerOid: proof.ownerOid, runtimeOid: proof.runtimeOid };
    }
    private async drainVerification(): Promise<void> {
        while (this.verificationTasks.size)
            await Promise.allSettled([...this.verificationTasks]);
        if (this.verificationFailures.length)
            throw this.verificationFailures[0];
    }
    async backend(client: PoolClient, kind: 'ddl' | 'migration'): Promise<void> {
        await this.session.verify();
        const backend = (await client.query<{
            pid: number;
            backend_start: string;
        }>(`SELECT
      pg_backend_pid() AS pid,backend_start::text FROM pg_stat_activity
      WHERE pid=pg_backend_pid()`)).rows[0];
        if (!backend)
            throw new Error('PROVISIONING_BACKEND_UNIDENTIFIED');
        await client.query("SELECT set_config('application_name',$1,false)", [`t06:${this.executionId}:${kind}`]);
        const registry = await this.inventory.connect();
        try {
            await registry.query('BEGIN');
            await registry.query('SET LOCAL ROLE control_t06');
            const result = await registry.query(`UPDATE control.provisioning_execution
        SET backends=backends || jsonb_build_array($2::jsonb)
        WHERE execution_id=$1 AND state='RUNNING'
          AND EXISTS(SELECT 1 FROM control.provisioning_gate
            WHERE execution_id=$1 AND state='RUNNING') RETURNING execution_id`, [this.executionId, JSON.stringify({ ...backend, kind, execution_id: this.executionId })]);
            if (result.rowCount !== 1)
                throw new Error('PROVISIONING_BACKEND_REGISTRATION_REFUSED');
            await registry.query('COMMIT');
        }
        catch (error) {
            await registry.query('ROLLBACK').catch(() => { });
            throw error;
        }
        finally {
            registry.release();
        }
        const detach = this.session.onLost(() => { void client.end().catch(() => { }); });
        client.once('end', detach);
        await this.session.verify();
    }
}
