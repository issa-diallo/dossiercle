/** Only an explicitly selected private Compose test command installs this barrier. */
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { startProvisioner } from '../dist/provisioning/provisioner.main.js';
const [target] = process.argv.slice(2);
const registry = JSON.parse(await readFile('/run/s01-fixtures/registry.json', 'utf8'));
if (!registry.syntheticOnly || registry.root !== process.env.S01_T06_ROOT || !target)
    throw new Error('SYNTHETIC_REQUIRED');
let paused = false;
await startProvisioner({ afterWake: async (eventId, result) => {
        if (eventId !== target)
            return;
        await appendFile('/tmp/t06-callbacks.ndjson', JSON.stringify({ eventId, disposition: result.disposition }) + '\n', { mode: 0o600 });
        if (!paused && result.disposition === 'closed') {
            paused = true;
            await writeFile('/tmp/t06-before-ack', 'READY', { flag: 'wx', mode: 0o600 });
            for (;;) {
                try {
                    await readFile('/tmp/t06-release-ack');
                    break;
                }
                catch (error) {
                    if (error.code !== 'ENOENT')
                        throw error;
                }
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
    } });
