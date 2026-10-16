import { Pool, type PoolClient } from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { AuthorityJournal } from '../journal/authority-journal.js';
import type { FileSecretStore } from '../secrets/secret-store.js';
import { ControlRepository } from './control.repository.js';
import { TenantRouter, type AgencyIdentity, type ActiveLocator } from './tenant-router.js';
/** Server wiring for identities returned by the native AuthService, never request fields. */
export function createTenantRouter(options: {
    control: Pool;
    journal: AuthorityJournal;
    secrets: FileSecretStore;
    host: string;
    port: number;
}): TenantRouter {
    const held = new AsyncLocalStorage<{
        identity: AgencyIdentity;
        client: PoolClient;
        active: boolean;
    }>();
    const connection = () => { const lease = held.getStore(); return lease?.active ? lease.client : options.control; };
    const authority = new ControlRepository(options.control, options.journal);
    const withAuthority = async <T>(identity: AgencyIdentity, work: () => Promise<T>): Promise<T> => {
        if (held.getStore()?.active && held.getStore()?.identity === identity)
            return work();
        if (!identity.sessionCookieHash || !/^[0-9a-f]{64}$/.test(identity.sessionCookieHash))
            throw new Error('TENANT_AUTHORIZATION_CLOSED');
        return authority.withAuthority(identity.subjectId, false, async (client, projection) => {
            if (projection.identityEpoch !== identity.sessionEpoch)
                throw new Error('TENANT_AUTHORIZATION_CLOSED');
            const membership = (await client.query(`SELECT role,state FROM identity.membership
    WHERE subject_id=$1 AND agency_id=$2 FOR SHARE`, [identity.subjectId, identity.agencyId])).rows[0];
            const agency = (await client.query(`SELECT state,invitation_root_id FROM control.agency
    WHERE id=$1 FOR SHARE`, [identity.agencyId])).rows[0];
            const session = (await client.query(`SELECT subject_id,scope,agency_id,invitation_root_id,epoch::text,
    revoked_at,absolute_expires_at,last_human_activity_at FROM identity.session
    WHERE cookie_hash=$1 FOR SHARE`, [identity.sessionCookieHash])).rows[0];
            const now = Date.now();
            if (!membership || membership.role !== 'ADMIN' || membership.state !== 'ACTIVE' || agency?.state !== 'ACTIVE'
                || !session || session.subject_id !== identity.subjectId || session.scope !== 'agency' || session.agency_id !== identity.agencyId
                || session.invitation_root_id !== agency.invitation_root_id || session.epoch !== identity.sessionEpoch.toString()
                || session.revoked_at !== null || new Date(session.absolute_expires_at).getTime() <= now
                || new Date(session.last_human_activity_at).getTime() + 30 * 60 * 1000 <= now)
                throw new Error('TENANT_AUTHORIZATION_CLOSED');
            // All central barriers remain held until tenant SQL and its post-connect readbacks finish.
            const lease = { identity, client, active: true };
            try {
                return await held.run(lease, work);
            }
            finally {
                lease.active = false;
            }
        });
    };
    return new TenantRouter({
        withAuthority,
        authorize: async (identity) => {
            try {
                await withAuthority(identity, async () => { });
                return true;
            }
            catch {
                return false;
            }
        },
        locator: async (agencyId) => {
            const row = (await connection().query(`SELECT a.state,l.* FROM control.agency a
    JOIN control.database_locator l ON l.agency_id=a.id WHERE a.id=$1`, [agencyId])).rows[0];
            return row ? { agencyId, state: row.state, databaseName: row.database_name, runtimeRole: row.runtime_role,
                secretRef: row.secret_ref, secretVersion: row.secret_version, verificationVersion: BigInt(row.verification_version) } as ActiveLocator : null;
        },
        resolve: async (locator) => {
            const operation = (await connection().query('SELECT id FROM control.provisioning_operation WHERE agency_id=$1', [locator.agencyId])).rows[0];
            if (!operation)
                throw new Error('TENANT_SECRET_BINDING_REFUSED');
            const password = await options.secrets.read({ agencyId: locator.agencyId, operationId: operation.id,
                secretRef: locator.secretRef, version: locator.secretVersion, kind: 'runtime' });
            return { host: options.host, port: options.port, database: locator.databaseName, user: locator.runtimeRole, password: password.toString() };
        },
        createPool: configuration => new Pool(configuration),
    });
}
