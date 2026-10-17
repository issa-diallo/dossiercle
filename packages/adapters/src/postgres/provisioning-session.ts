import type { Pool, PoolClient } from 'pg';
/** A capability tied to exactly one PostgreSQL session. It never reconnects. */
export class ProvisioningSession {
    private valid = true;
    private operationId: string | undefined;
    private readonly lostListeners = new Set<() => void>();
    private readonly handleClientLoss = () => this.invalidate();
    private constructor(readonly client: PoolClient) {
        client.on('error', this.handleClientLoss);
        client.on('end', this.handleClientLoss);
    }
    static async acquire(pool: Pool): Promise<ProvisioningSession | null> {
        const client = await pool.connect();
        const session = new ProvisioningSession(client);
        try {
            const result = await client.query<{
                locked: boolean;
            }>("SELECT pg_try_advisory_lock(hashtextextended('s01.t06.singleton',0)) AS locked");
            if (!result.rows[0]?.locked) {
                session.retire();
                client.release();
                return null;
            }
            return session;
        }
        catch (error) {
            session.retire();
            client.release(true);
            throw error;
        }
    }
    async lockOperation(operationId: string): Promise<void> {
        this.assertValid();
        const result = await this.client.query<{
            locked: boolean;
        }>("SELECT pg_try_advisory_lock(hashtextextended('s01.t06.operation:' || $1,0)) AS locked", [operationId]);
        if (!result.rows[0]?.locked)
            throw new Error('PROVISIONING_OPERATION_BUSY');
        this.operationId = operationId;
    }
    assertValid(): void {
        if (!this.valid)
            throw new Error('PROVISIONING_LOCK_LOST');
    }
    async verify(): Promise<void> {
        this.assertValid();
        try {
            const result = await this.client.query<{
                n: number;
            }>(`WITH keys AS (
        SELECT hashtextextended('s01.t06.singleton',0) AS v UNION ALL
        SELECT hashtextextended('s01.t06.operation:' || $1,0))
        SELECT count(*)::int AS n FROM keys k JOIN pg_locks l
        ON l.classid=((k.v>>32)&4294967295)::oid AND l.objid=(k.v&4294967295)::oid
        WHERE l.pid=pg_backend_pid() AND l.locktype='advisory' AND l.granted
          AND l.mode='ExclusiveLock' AND l.objsubid=1`, [this.operationId ?? '']);
            if (result.rows[0]?.n !== (this.operationId ? 2 : 1))
                throw new Error('LOCK_MISSING');
        }
        catch {
            this.invalidate();
            throw new Error('PROVISIONING_LOCK_LOST');
        }
    }
    onLost(listener: () => void): () => void {
        this.lostListeners.add(listener);
        return () => this.lostListeners.delete(listener);
    }
    /** Existing repository transactions all run on the lock-owning connection. */
    repositoryPool(): Pick<Pool, 'connect'> {
        return { connect: async () => {
                this.assertValid();
                return new Proxy(this.client, {
                    get(target, property) {
                        if (property === 'release')
                            return () => { };
                        const value = Reflect.get(target, property);
                        return typeof value === 'function' ? value.bind(target) : value;
                    },
                });
            } };
    }
    async close(): Promise<void> {
        if (!this.valid) {
            this.retire();
            this.client.release(true);
            return;
        }
        try {
            await this.client.query('SELECT pg_advisory_unlock_all()');
        }
        finally {
            this.retire();
            this.client.release(true);
        }
    }
    /** Retiring an owner is not a connection-loss notification. */
    private retire(): void {
        this.valid = false;
        this.lostListeners.clear();
        this.client.removeListener('error', this.handleClientLoss);
        this.client.removeListener('end', this.handleClientLoss);
    }
    private invalidate(): void {
        if (!this.valid)
            return;
        this.valid = false;
        for (const listener of this.lostListeners)
            listener();
        this.lostListeners.clear();
    }
}
