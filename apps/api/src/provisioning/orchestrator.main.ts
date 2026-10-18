import { createServer } from 'node:http';
import { provisioningEngine } from '@dossiercle/adapters/outbox/provisioning-engine';
import { OutboxDispatcher } from '@dossiercle/adapters/outbox/outbox-dispatcher';
import { controlPool } from '@dossiercle/adapters/postgres/runtime-pool';
import { assertControlProvisioningSchema } from '@dossiercle/adapters/postgres/migrate';
import { parseProvisioningEvent } from '@dossiercle/contracts/provisioning-events';
import { privateBytes, fixtureRegistry } from './private-files.js';
import { provisionerWake } from './provisioning.function.js';
import { provisionerProjectActivation } from './provisioning.function.js';
import { activationProjection } from './activation.function.js';
export async function startOrchestrator() {
    const pool = controlPool({ host: 'postgres', port: 5432, role: 'control_dispatcher', max: 2,
        password: (await privateBytes('/run/s01-pg/dispatcher')).toString('utf8').trim() });
    try {
        const c = await pool.connect();
        try {
            await assertControlProvisioningSchema(c);
        }
        finally {
            c.release();
        }
        await fixtureRegistry();
        const wake = provisionerWake({ key: await privateBytes('/run/s01-t06-tls/server.key'),
            cert: await privateBytes('/run/s01-t06-tls/server.crt'), ca: await privateBytes('/run/s01-t06-ca.crt') });
        const projectLocal=provisionerProjectActivation({key:await privateBytes('/run/s01-t06-tls/server.key'),
            cert:await privateBytes('/run/s01-t06-tls/server.crt'),ca:await privateBytes('/run/s01-t06-ca.crt')});
        const project=activationProjection(async(eventId)=>{
            const source=(await pool.query(`SELECT 1 FROM control.outbox o JOIN control.audit_event a USING(event_id)
              JOIN control.agency g ON g.id=a.agency_id JOIN control.provisioning_operation p ON p.agency_id=g.id
              WHERE o.event_id=$1 AND o.type='agency.activated.v1' AND a.event_type=o.type
                AND o.schema_version=1 AND a.schema_version=o.schema_version
                AND o.agency_id=a.agency_id AND o.resource_id=a.resource_id AND o.version=a.resource_version
                AND g.state='ACTIVE' AND g.activated_at IS NOT NULL AND g.version=a.resource_version
                AND p.status='SUCCEEDED' AND p.step='ACTIVE' AND a.resource_id=g.id AND a.correlation=p.id`,[eventId])).rows[0];
            if(!source)throw new Error('ACTIVATION_EVENT_SOURCE_REFUSED');
            await projectLocal(eventId);
        });
        const engine = provisioningEngine({ signingKey: (await privateBytes('/run/s01-inngest-signing-key')).toString().trim(),
            eventKey: (await privateBytes('/run/s01-inngest-event-key')).toString().trim(), baseUrl: 'http://inngest:8288' }, async (event) => {
            const data = parseProvisioningEvent(event.name, event.data).data;
            const source = (await pool.query(`SELECT 1 FROM control.outbox o JOIN control.audit_event a USING(event_id)
    WHERE o.event_id=$1 AND o.type=$2 AND o.agency_id=$3 AND o.resource_id=$4 AND o.version=$5
      AND a.event_type=o.type AND a.agency_id=o.agency_id AND a.resource_id=o.resource_id
      AND a.resource_version=o.version AND a.schema_version=o.schema_version`, [event.id, event.name, data.agencyId, data.resourceId, data.version])).rows[0];
            if (!source)
                throw new Error('PROVISIONING_EVENT_SOURCE_REFUSED');
            if (event.name === 'agency.provisioning-wakeup') {
                const wakeData = parseProvisioningEvent(event.name, event.data);
                if (wakeData.name !== 'agency.provisioning-wakeup')
                    throw new Error('PROVISIONING_EVENT_REFUSED');
                const d = wakeData.data;
                const ledger = (await pool.query(`SELECT 1 FROM control.provisioning_wakeup WHERE event_id=$1
      AND expected_operation_version=$2 AND target_attempt=$3 AND delivery_round=$4 AND generation=$5`, [event.id, d.expectedOperationVersion, d.targetAttempt, d.deliveryRound, d.version])).rows[0];
                if (!ledger)
                    throw new Error('PROVISIONING_EVENT_SOURCE_REFUSED');
            }
            return wake(event.id);
        },project);
        const dispatcher = new OutboxDispatcher(pool, engine.client, async () => [...(await fixtureRegistry()).t06,...(await fixtureRegistry()).t07].map(t => t.agencyId));
        let stopping = false, scanning = false;
        const scan = async () => {
            if (stopping || scanning)
                return;
            scanning = true;
            try {
                for (const tuple of [...(await fixtureRegistry()).t06,...(await fixtureRegistry()).t07])
                    await pool.query('SELECT control.reserve_t06_wakeup($1)', [tuple.operationId]);
                for (let n = 0; n < 100 && !stopping; n++)
                    if (!await dispatcher.dispatchOne())
                        break;
            }
            catch {
                process.stderr.write('T06_DELIVERY_UNAVAILABLE\n');
            }
            finally {
                scanning = false;
            }
        };
        const server = createServer((req, res) => {
            if (req.headers.host !== 't06-orchestrator:8288') {
                res.writeHead(403).end();
                req.resume();
                return;
            }
            if (req.url === '/health' && req.method === 'GET') {
                res.writeHead(200).end('ready');
                return;
            }
            const pathname = new URL(req.url ?? '', 'http://t06-orchestrator:8288').pathname;
            if (pathname !== '/api/inngest' || !['GET', 'POST', 'PUT'].includes(req.method ?? '')) {
                res.writeHead(404).end();
                req.resume();
                return;
            }
            const length = Number(req.headers['content-length'] ?? 0);
            if (req.headers['transfer-encoding'] || !Number.isSafeInteger(length) || length < 0 || length > 65536
                || (['POST', 'PUT'].includes(req.method ?? '') && !req.headers['content-length'])) {
                res.writeHead(413).end();
                req.resume();
                return;
            }
            // HTTP framing bounds the sole SDK reader; a second data listener would steal its body.
            engine.listener(req, res);
        });
        server.requestTimeout = 15000;
        server.headersTimeout = 10000;
        server.timeout = 65000;
        server.maxHeadersCount = 64;
        server.maxRequestsPerSocket = 1;
        await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(8288, '0.0.0.0', resolve); });
        const timer = setInterval(() => { void scan(); }, 30000);
        timer.unref();
        const stop = () => { stopping = true; clearInterval(timer); server.close(); void pool.end().then(() => process.exit(0)); };
        process.once('SIGTERM', stop);
        process.once('SIGINT', stop);
        // The first scan is delayed until SDK registration, also preserving source outbox receipts.
        return server;
    }
    catch (error) {
        await pool.end();
        throw error;
    }
}
if (import.meta.url === `file://${process.argv[1]}`) {
    try {
        await startOrchestrator();
    }
    catch {
        process.stderr.write('T06_ORCHESTRATOR_CLOSED\n');
        process.exitCode = 1;
    }
}
