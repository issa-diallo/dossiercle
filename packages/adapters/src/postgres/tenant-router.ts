import { Pool, type QueryResultRow } from 'pg';
import { verificationAgency, withVerificationAuthority, type TenantVerificationContext } from './provisioning-attempt.js';
import { AgencyRepository } from './agency.repository.js';
export interface AgencyIdentity {
    subjectId: string;
    agencyId: string;
    sessionEpoch: bigint;
    sessionCookieHash?: string;
}
declare const contextBrand: unique symbol;
export type AgencySession = {
    readonly [contextBrand]: true;
};
export interface ActiveLocator {
    agencyId: string;
    state: 'ACTIVE' | 'READY' | 'PROVISIONING' | 'FAILED';
    databaseName: string;
    runtimeRole: string;
    secretRef: string;
    secretVersion: number;
    verificationVersion: bigint;
}
export interface RuntimeCredential {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
}
export interface TenantRouterDependencies {
    authorize(session: AgencyIdentity): Promise<boolean>;
    withAuthority<T>(session: AgencyIdentity, work: () => Promise<T>): Promise<T>;
    locator(agencyId: string): Promise<ActiveLocator | null>;
    resolve(locator: ActiveLocator): Promise<RuntimeCredential>;
    createPool(options: RuntimeCredential & {
        max: number;
        connectionTimeoutMillis: number;
        idleTimeoutMillis: number;
        statement_timeout: number;
        query_timeout: number;
    }): Pool;
}
interface Entry {
    pool: Pool;
    agencyId: string;
    lastUsed: number;
    active: number;
}
// One process budget, including independently constructed server adapters.
const processPools = new Map<Entry, () => void>();
let processQueue: Promise<void> = Promise.resolve();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Server-only repository adapter. Contexts are bound by identity, not client fields. */
export class TenantRouter {
    private readonly contexts = new WeakMap<AgencySession, AgencyIdentity>();
    private readonly pools = new Map<string, Entry>();
    private closed = false;
    private readonly timer: ReturnType<typeof setInterval>;
    constructor(private readonly dependencies: TenantRouterDependencies, private readonly maxPools = 4) {
        if (!Number.isInteger(maxPools) || maxPools < 1 || maxPools > 4)
            throw new Error('INVALID_TENANT_POOL_LIMIT');
        this.timer = setInterval(() => { void this.serialize(() => this.expire()).catch(() => { }); }, 1000);
        this.timer.unref();
    }
    async context(identity: AgencyIdentity): Promise<AgencySession> {
        if (!uuid.test(identity.subjectId) || !uuid.test(identity.agencyId) || identity.sessionEpoch < 1n
            || !await this.dependencies.authorize(identity))
            throw new Error('TENANT_AUTHORIZATION_CLOSED');
        const context = Object.freeze({}) as AgencySession;
        this.contexts.set(context, Object.freeze({ ...identity }));
        return context;
    }
    async query<T extends QueryResultRow>(context: AgencySession, sql: string, values: unknown[] = []): Promise<T[]> {
        const identity = this.contexts.get(context);
        if (!identity || this.closed)
            throw new Error('TENANT_CONTEXT_REFUSED');
        return this.dependencies.withAuthority(identity, async () => {
            const locator = await this.current(identity);
            const key = this.key(locator);
            const entry = await this.serialize(() => this.acquire(key, locator));
            try {
                const client = await entry.pool.connect().catch(() => { throw new Error('TENANT_CAPACITY_UNAVAILABLE'); });
                try {
                    const actual = (await client.query('SELECT current_database() AS database,current_user AS role')).rows[0];
                    if (actual?.database !== locator.databaseName || actual.role !== locator.runtimeRole)
                        throw new Error('TENANT_CONNECTION_SUBSTITUTED');
                    const repository = new AgencyRepository();
                    await repository.verify(client, identity.agencyId);
                    await repository.verifyRuntimeAcl(client, locator.runtimeRole, `agm_${identity.agencyId.replaceAll('-', '')}`);
                    const current = await this.current(identity);
                    if (this.key(current) !== key)
                        throw new Error('TENANT_LOCATOR_CHANGED');
                    return (await client.query<T>(sql, values)).rows;
                }
                finally {
                    client.release();
                }
            }
            finally {
                entry.active--;
                entry.lastUsed = Date.now();
            }
        });
    }
    /** Private T06 verification only; this does not create human agency access. */
    async queryVerification<T extends QueryResultRow>(context: TenantVerificationContext, sql: string, values: unknown[] = []): Promise<T[]> {
        return withVerificationAuthority(context, async (agencyId) => {
            const locator = await this.dependencies.locator(agencyId);
            if (!locator || locator.agencyId !== agencyId || locator.state !== 'PROVISIONING'
                || locator.secretVersion < 1 || locator.verificationVersion < 0n
                || locator.databaseName !== `ag_${agencyId.replaceAll('-', '')}`
                || locator.runtimeRole !== `agr_${agencyId.replaceAll('-', '')}`)
                throw new Error('TENANT_VERIFICATION_CLOSED');
            const key = this.key(locator), entry = await this.serialize(() => this.acquire(key, locator));
            try {
                const client = await entry.pool.connect().catch(() => { throw new Error('TENANT_CAPACITY_UNAVAILABLE'); });
                try {
                    const actual = (await client.query('SELECT current_database() AS database,current_user AS role')).rows[0];
                    if (actual?.database !== locator.databaseName || actual.role !== locator.runtimeRole)
                        throw new Error('TENANT_CONNECTION_SUBSTITUTED');
                    const repository = new AgencyRepository();
                    await repository.verify(client, agencyId);
                    await repository.verifyRuntimeAcl(client, locator.runtimeRole, `agm_${agencyId.replaceAll('-', '')}`);
                    await verificationAgency(context);
                    const current = await this.dependencies.locator(agencyId);
                    if (!current || this.key(current) !== key)
                        throw new Error('TENANT_LOCATOR_CHANGED');
                    return (await client.query<T>(sql, values)).rows;
                }
                finally {
                    client.release();
                }
            }
            finally {
                entry.active--;
                entry.lastUsed = Date.now();
            }
        });
    }
    async close(): Promise<void> {
        this.closed = true;
        clearInterval(this.timer);
        await this.serialize(async () => {
            await Promise.all([...this.pools.values()].map(v => this.evict(v)));
            this.pools.clear();
        });
    }
    private async current(identity: AgencyIdentity): Promise<ActiveLocator> {
        if (!await this.dependencies.authorize(identity))
            throw new Error('TENANT_AUTHORIZATION_CLOSED');
        const locator = await this.dependencies.locator(identity.agencyId);
        if (!locator || locator.agencyId !== identity.agencyId || locator.state !== 'ACTIVE'
            || !Number.isInteger(locator.secretVersion) || locator.secretVersion < 1
            || locator.verificationVersion < 1n)
            throw new Error('TENANT_NOT_ACTIVE');
        if (locator.databaseName !== `ag_${identity.agencyId.replaceAll('-', '')}`
            || locator.runtimeRole !== `agr_${identity.agencyId.replaceAll('-', '')}`)
            throw new Error('TENANT_LOCATOR_REFUSED');
        return locator;
    }
    private key(locator: ActiveLocator) {
        return [locator.agencyId, locator.secretVersion, locator.verificationVersion].join(':');
    }
    private async acquire(key: string, locator: ActiveLocator): Promise<Entry> {
        if (this.closed)
            throw new Error('TENANT_ROUTER_CLOSED');
        for (const [oldKey, entry] of this.pools) {
            if (entry.agencyId === locator.agencyId && oldKey !== key) {
                if (entry.active)
                    throw new Error('TENANT_CAPACITY_UNAVAILABLE');
                await this.evict(entry);
            }
        }
        const existing = this.pools.get(key);
        if (existing) {
            existing.active++;
            existing.lastUsed = Date.now();
            return existing;
        }
        await this.expire();
        if (this.pools.size >= this.maxPools) {
            const idle = [...this.pools.entries()].filter(([, entry]) => entry.active === 0)
                .sort((a, b) => a[1].lastUsed - b[1].lastUsed)[0];
            if (!idle)
                throw new Error('TENANT_CAPACITY_UNAVAILABLE');
            await this.evict(idle[1]);
        }
        if (processPools.size >= 4) {
            const idle = [...processPools.keys()].filter(entry => entry.active === 0)
                .sort((a, b) => a.lastUsed - b.lastUsed)[0];
            if (!idle)
                throw new Error('TENANT_CAPACITY_UNAVAILABLE');
            await this.evict(idle);
        }
        const credential = await this.dependencies.resolve(locator);
        if (credential.database !== locator.databaseName || credential.user !== locator.runtimeRole
            || !credential.password)
            throw new Error('TENANT_SECRET_BINDING_REFUSED');
        const pool = this.dependencies.createPool({ ...credential, max: 2, connectionTimeoutMillis: 2000,
            idleTimeoutMillis: 60000, statement_timeout: 5000, query_timeout: 5000 });
        const entry = { pool, agencyId: locator.agencyId, lastUsed: Date.now(), active: 1 };
        this.pools.set(key, entry);
        processPools.set(entry, () => { this.pools.delete(key); });
        return entry;
    }
    private async expire(): Promise<void> {
        for (const entry of this.pools.values())
            if (!entry.active && Date.now() - entry.lastUsed >= 60000) {
                await this.evict(entry);
            }
    }
    private async evict(entry: Entry): Promise<void> {
        await entry.pool.end();
        processPools.get(entry)?.();
        processPools.delete(entry);
    }
    private serialize<T>(work: () => Promise<T>): Promise<T> {
        const result = processQueue.then(work);
        processQueue = result.then(() => { }, () => { });
        return result;
    }
}
