import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { Pool, controlPool } from '@dossiercle/adapters/postgres/runtime-pool';
import { assertControlProvisioningSchema } from '@dossiercle/adapters/postgres/migrate';
import { FileSecretStore } from '@dossiercle/adapters/secrets/secret-store';
import { AuthorityJournal } from '@dossiercle/adapters/journal/authority-journal';
import { ProvisioningService, type WakeResult } from './provisioning.service.js';
import { privateBytes, fixtureRegistry } from './private-files.js';
import { provisionerServer } from './provisioner.server.js';
import { ActivationAuditService } from './activation-audit.service.js';
export async function startProvisioner(fixture?: {
    afterWake: (eventId: string, result: WakeResult) => Promise<void>;
}) {
    const instanceId = randomUUID();
    const pool = controlPool({ host: 'postgres', port: 5432, role: 'provisioner', max: 4,
        password: (await privateBytes('/run/s01-pg/provisioner')).toString('utf8').trim() });
    const ddl = new Pool({ host: 'postgres', port: 5432, database: 'postgres', user: 'provisioner_ddl', max: 1,
        connectionTimeoutMillis: 2000, idleTimeoutMillis: 60000, statement_timeout: 5000, query_timeout: 7000,
        password: (await privateBytes('/run/s01-pg/ddl')).toString('utf8').trim() });
    try {
        const client = await pool.connect();
        try {
            await assertControlProvisioningSchema(client);
        }
        finally {
            client.release();
        }
        await fixtureRegistry();
        const service = new ProvisioningService({ pool, ddl, host: 'postgres', port: 5432, instanceId,
            runtimeSecrets: new FileSecretStore('/run/s01-t06-runtime'),
            migrationSecrets: new FileSecretStore('/run/s01-t06-migration'),
            journal: new AuthorityJournal('/var/lib/s01-journal/application'),
            allowed: async () => {const fixtures=await fixtureRegistry();return [...fixtures.t06,...fixtures.t07];} });
        const activationAudit=new ActivationAuditService({pool,secrets:new FileSecretStore('/run/s01-t06-migration'),host:'postgres',port:5432});
        const server = provisionerServer(service, { key: await privateBytes('/run/s01-t06-tls/server.key'),
            cert: await privateBytes('/run/s01-t06-tls/server.crt'), ca: await privateBytes('/run/s01-t06-ca.crt') }, fixture?.afterWake,activationAudit);
        await writeFile('/tmp/t06-instance.json', JSON.stringify({ instanceId, pid: process.pid }), { flag: 'wx', mode: 0o600 });
        await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(4443, '0.0.0.0', resolve); });
        const stop = () => { server.close(); void Promise.all([pool.end(), ddl.end()]).then(() => process.exit(0)); };
        process.once('SIGTERM', stop);
        process.once('SIGINT', stop);
        return server;
    }
    catch (error) {
        await Promise.all([pool.end(), ddl.end()]);
        throw error;
    }
}
if (import.meta.url === `file://${process.argv[1]}`) {
    try {
        await startProvisioner();
    }
    catch {
        process.stderr.write('T06_PROVISIONER_CLOSED\n');
        process.exitCode = 1;
    }
}
