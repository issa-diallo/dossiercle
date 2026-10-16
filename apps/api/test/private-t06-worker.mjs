/** Process-only synthetic worker. It is not selected by the application launcher. */
import { readFile, writeFile } from 'node:fs/promises';
import { Pool, controlPool } from '../../../packages/adapters/dist/postgres/runtime-pool.js';
import { FileSecretStore } from '../../../packages/adapters/dist/secrets/secret-store.js';
import { AuthorityJournal } from '../../../packages/adapters/dist/journal/authority-journal.js';
import { ProvisioningService } from '../dist/provisioning/provisioning.service.js';
const [eventId, instanceId, pause] = process.argv.slice(2);
const registry = JSON.parse(await readFile('/run/s01-fixtures/registry.json'));
if (!registry.syntheticOnly || registry.root !== process.env.S01_T06_ROOT)
    throw new Error('SYNTHETIC_REQUIRED');
const pool = controlPool({ host: 'postgres', port: 5432, role: 'provisioner', max: 4,
    password: (await readFile('/run/s01-pg/provisioner', 'utf8')).trim() });
const ddl = new Pool({ host: 'postgres', port: 5432, database: 'postgres', user: 'provisioner_ddl', max: 1,
    password: (await readFile('/run/s01-pg/ddl', 'utf8')).trim() });
await writeFile('/tmp/t06-instance.json', JSON.stringify({ instanceId, pid: process.pid }), { flag: 'wx', mode: 0o600 });
let paused = false;
async function boundary(stage) {
    if (stage === pause && !paused) {
        paused = true;
        await writeFile('/tmp/t06-stage', stage, { flag: 'wx', mode: 0o600 });
        for (;;) {
            try {
                await readFile('/tmp/t06-release');
                break;
            }
            catch (error) {
                if (error.code !== 'ENOENT')
                    throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 20));
        }
    }
}
const service = new ProvisioningService({ pool, ddl, host: 'postgres', port: 5432, instanceId,
    runtimeSecrets: new FileSecretStore('/run/s01-t06-runtime'), migrationSecrets: new FileSecretStore('/run/s01-t06-migration'),
    journal: new AuthorityJournal('/var/lib/s01-journal/application'), allowed: async () => registry.t06,
    beforeLocalAudit: async (client) => {
        if (pause === 'FAULT:AUDIT_REFUSED')
            await client.query('SET default_transaction_read_only=on');
    },
    afterLocalAuditInsert: async (client) => {
        if (pause === 'FAULT:AUDIT_ACK_LOST')
            await client.end();
    },
    beforePrepareCommit: () => boundary('PREPARE'), afterDdlBoundary: stage => boundary('DDL:' + stage),
    beforeEffect: kind => boundary('BEFORE:' + kind), afterEffect: kind => boundary('AFTER:' + kind),
});
const result = await service.wake(eventId);
await pool.end();
await ddl.end();
await writeFile('/tmp/t06-result.json', JSON.stringify(result), { flag: 'wx', mode: 0o600 });
// The old process deliberately remains alive after SIGCONT; host fencing must stop it.
setInterval(() => { }, 1000);
