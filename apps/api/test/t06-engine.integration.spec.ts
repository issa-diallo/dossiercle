import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, it, expect } from 'vitest';
import { createT06Fixture, t06Environment, t06Pool } from './private-t06-fixture.js';
const exec = promisify(execFile);
const compose = ['compose', '--profile', 't06', '--env-file', '.local/compose.env', '-f', 'infra/local/compose.yaml'];
const docker = async (args: string[]) => (await exec('docker', args, { timeout: 90000 })).stdout.trim();
async function ready(agencyId: string) {
    const pool = await t06Pool('control_migrator');
    try {
        const until = Date.now() + 90000;
        while (Date.now() < until) {
            const row = (await pool.query('SELECT state FROM control.agency WHERE id=$1', [agencyId])).rows[0];
            if (row.state === 'READY')
                return;
            await new Promise(resolve => setTimeout(resolve, 250));
        }
        throw new Error('NATIVE_ENGINE_READY_TIMEOUT');
    }
    finally {
        await pool.end();
    }
}
describe('native pinned Inngest and private mTLS T06 delivery', () => {
    it('rejects unsigned, bad-signature, chunked, oversize and wrong-certificate callbacks', async () => {
        await exec('bash', ['scripts/s01-t06-start.sh'], { timeout: 90000 });
        const e = await t06Environment(), name = e.project + '-t06-orchestrator-1';
        const result = JSON.parse(await docker(['exec', name, '/s01-node', '--input-type=module', '-e', `
   import {request} from 'node:http';import {request as tlsRequest} from 'node:https';
   import {readFile,writeFile} from 'node:fs/promises';
   const base='http://t06-orchestrator:8288/api/inngest';
   const unsigned=await fetch(base,{method:'POST',body:'{}'});
   const forged=await fetch(base,{method:'POST',body:'{}',headers:{'x-inngest-signature':'t=1&s=bad'}});
   const oversized=await fetch(base,{method:'POST',body:'x'.repeat(65537)});
   const chunked=await new Promise((resolve,reject)=>{const q=request(base,{method:'POST',headers:{'Transfer-Encoding':'chunked'}},r=>{r.resume();resolve(r.statusCode);});q.on('error',reject);q.write('{}');q.end();});
   const ca=await readFile('/run/s01-t06-ca.crt');
   const noCertificate=await new Promise(resolve=>{const q=tlsRequest({host:'t06-provisioner',port:4443,servername:'t06-provisioner',ca,method:'POST',path:'/internal/t06/wake',agent:false},r=>{r.resume();resolve(r.statusCode);});q.on('error',()=>resolve('TLS_REJECTED'));q.end('{}');});
   const key=await readFile('/run/s01-t06-tls/server.key'),cert=await readFile('/run/s01-t06-tls/server.crt');
   const badShape=await new Promise((resolve,reject)=>{const q=tlsRequest({host:'t06-provisioner',port:4443,servername:'t06-provisioner',ca,key,cert,method:'POST',path:'/internal/t06/wake',headers:{Host:'t06-provisioner:4443','Content-Type':'application/json'},agent:false},r=>{r.resume();resolve(r.statusCode);});q.on('error',reject);q.end(JSON.stringify({eventId:'11111111-1111-4111-8111-111111111111',database:'forged'}));});
   const privateCall=(method,host,body)=>new Promise((resolve,reject)=>{
    const q=tlsRequest({host:'t06-provisioner',port:4443,servername:'t06-provisioner',ca,key,cert,method,path:'/internal/t06/wake',
     headers:{Host:host,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)},agent:false},r=>{r.resume();resolve(r.statusCode);});
    q.on('error',reject);q.end(body);
   });
   const wrongHost=await privateCall('POST','substituted.invalid:4443','{}');
   const wrongMethod=await privateCall('GET','t06-provisioner:4443','');
   const privateOversize=await privateCall('POST','t06-provisioner:4443','x'.repeat(4097));
   console.log(JSON.stringify({unsigned:unsigned.status,forged:forged.status,oversized:oversized.status,chunked,noCertificate,badShape,wrongHost,wrongMethod,privateOversize}));
  `]));
        expect(result).toEqual({ unsigned: 401, forged: 401, oversized: 413, chunked: 413, noCertificate: 'TLS_REJECTED', badShape: 400, wrongHost: 403, wrongMethod: 403, privateOversize: 413 });
        const wrong = JSON.parse(await docker([...compose, 'exec', '-T', 't06-provisioner', '/s01-node', '--input-type=module', '-e', `
   import {request} from 'node:https';import {readFile,writeFile} from 'node:fs/promises';
   const ca=await readFile('/run/s01-t06-ca.crt'),key=await readFile('/run/s01-t06-tls/server.key'),cert=await readFile('/run/s01-t06-tls/server.crt');
   const status=await new Promise((resolve,reject)=>{const q=request({host:'t06-provisioner',port:4443,servername:'t06-provisioner',ca,key,cert,method:'POST',path:'/internal/t06/wake',headers:{Host:'t06-provisioner:4443','Content-Type':'application/json'},agent:false},r=>{r.resume();resolve(r.statusCode);});q.on('error',reject);q.end('{}');});console.log(JSON.stringify({status}));
  `]));
        expect(wrong.status).toBe(403);
    }, 120000);
    it('survives actual publish before SQL-ack loss, duplicate delivery and engine restart with one execution', async () => {
        const fixture = await createT06Fixture(), e = await t06Environment();
        const name = e.project + '-t06-orchestrator-1';
        try {
            await docker(['kill', '--signal', 'STOP', name]);
            const container = JSON.parse(await docker(['inspect', name]))[0];
            expect((await readFile(`/proc/${container.State.Pid}/stat`, 'utf8')).slice((await readFile(`/proc/${container.State.Pid}/stat`, 'utf8')).lastIndexOf(')') + 2).startsWith('T ')).toBe(true);
            const publication = JSON.parse(await docker(['exec', name, '/s01-node', '--input-type=module', '-e', `
    import {readFile,writeFile} from 'node:fs/promises';
    import {controlPool} from '/app/packages/adapters/dist/postgres/runtime-pool.js';
    import {provisioningEngine} from '/app/packages/adapters/dist/outbox/provisioning-engine.js';
    import {OutboxDispatcher} from '/app/packages/adapters/dist/outbox/outbox-dispatcher.js';
    const pool=controlPool({host:'postgres',port:5432,role:'control_dispatcher',max:2,password:(await readFile('/run/s01-pg/dispatcher','utf8')).trim()});
    const engine=provisioningEngine({baseUrl:'http://inngest:8288',signingKey:(await readFile('/run/s01-inngest-signing-key','utf8')).trim(),eventKey:(await readFile('/run/s01-inngest-event-key','utf8')).trim()},async()=>({operationId:null,disposition:'ignored'}));
    const d=new OutboxDispatcher(pool,engine.client,async()=>['${fixture.agencyId}']);
    let lost=false;try{await d.dispatchOne(async()=>{throw new Error('ACK_LOST');});}catch{lost=true;}
    const pending=(await pool.query('SELECT status FROM control.outbox WHERE event_id=$1',['${fixture.eventId}'])).rows[0].status;
    const replay=await d.dispatchOne();await pool.end();console.log(JSON.stringify({lost,pending,replay}));
   `]));
            expect(publication).toEqual({ lost: true, pending: 'PENDING', replay: true });
        }
        finally {
            await docker(['kill', '--signal', 'CONT', name]);
        }
        await ready(fixture.agencyId);
        const central = await t06Pool('control_migrator');
        try {
            const before = (await central.query('SELECT count(*)::int AS n FROM control.provisioning_execution WHERE operation_id=$1', [fixture.operationId])).rows[0].n;
            expect(before).toBe(1);
            await exec('bash', ['scripts/s01-t06-start.sh'], { timeout: 90000 });
            await docker([...compose, 'restart', 'inngest']);
            const healthDeadline = Date.now() + 30000;
            let healthy = false;
            while (Date.now() < healthDeadline) {
                const health = await docker(['exec', name, '/s01-node', '--input-type=module', '-e',
                    "try{console.log((await fetch('http://inngest:8288/health')).status)}catch{console.log('UNREADY')}"]);
                if (health === '200') {
                    healthy = true;
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            expect(healthy).toBe(true);
            // Persisted event receipts and SQL terminal state survive both server and SDK process restart.
            await docker(['exec', name, '/s01-node', '--input-type=module', '-e', `
    import {readFile,writeFile} from 'node:fs/promises';import {provisioningEngine} from '/app/packages/adapters/dist/outbox/provisioning-engine.js';
    const engine=provisioningEngine({baseUrl:'http://inngest:8288',signingKey:(await readFile('/run/s01-inngest-signing-key','utf8')).trim(),eventKey:(await readFile('/run/s01-inngest-event-key','utf8')).trim()},async()=>({operationId:null,disposition:'ignored'}));
    await engine.client.send({id:'${fixture.eventId}',name:'agency.creation-accepted',data:{schemaVersion:1,agencyId:'${fixture.agencyId}',resourceId:'${fixture.rootId}',version:'1'}});console.log('DUPLICATE_SENT');
   `]);
            await new Promise(resolve => setTimeout(resolve, 1500));
            expect((await central.query('SELECT count(*)::int AS n FROM control.provisioning_execution WHERE operation_id=$1', [fixture.operationId])).rows[0].n).toBe(before);
            expect((await central.query(`SELECT a.state,a.activated_at,m.state AS membership FROM control.agency a
    JOIN identity.membership m ON m.agency_id=a.id WHERE a.id=$1`, [fixture.agencyId])).rows[0])
                .toEqual({ state: 'READY', activated_at: null, membership: 'PENDING' });
        }
        finally {
            await central.end();
        }
    }, 150000);
    it('replays the same persisted durable step after SDK death before callback acknowledgement without another execution or resource', async () => {
        await exec(process.execPath, ['scripts/s01-t06-drain.mjs'], { timeout: 45000 });
        const fixture = await createT06Fixture(true), e = await t06Environment();
        const central = await t06Pool('control_migrator'), history = await t06Pool('inngest', 'inngest');
        const orchestrator = e.project + '-t06-orchestrator-1', provisioner = e.project + '-t06-provisioner-1';
        const snapshot = async () => {
            const locator = (await central.query(`SELECT l.*,(SELECT oid::text FROM pg_database WHERE datname=l.database_name) AS database_oid
    FROM control.database_locator l WHERE agency_id=$1`, [fixture.agencyId])).rows[0];
            const effects = (await central.query('SELECT kind,status,evidence FROM control.provisioning_effect WHERE operation_id=$1 ORDER BY kind', [fixture.operationId])).rows;
            return createHash('sha256').update(JSON.stringify({ locator, effects })).digest('hex');
        };
        try {
            await writeFile('.local/t06-response-loss-compose.json', JSON.stringify({ services: { 't06-provisioner': {
                        command: ['/s01-node', '/app/apps/api/test/private-t06-response-loss.mjs', fixture.eventId]
                    } } }), { mode: 0o600 });
            await docker([...compose, '-f', '.local/t06-response-loss-compose.json', 'up', '-d', '--no-deps', '--force-recreate', 't06-provisioner', 't06-orchestrator']);
            await expect.poll(async () => {
                try {
                    return await docker(['exec', orchestrator, '/s01-node', '--input-type=module', '-e',
                        "console.log((await fetch('http://t06-orchestrator:8288/health')).status)"]);
                }
                catch {
                    return 'UNREADY';
                }
            }, { timeout: 20000 }).toBe('200');
            await docker(['exec', orchestrator, '/s01-node', '--input-type=module', '-e', `
    import {readFile} from 'node:fs/promises';import {provisioningEngine} from '/app/packages/adapters/dist/outbox/provisioning-engine.js';
    const engine=provisioningEngine({baseUrl:'http://inngest:8288',signingKey:(await readFile('/run/s01-inngest-signing-key','utf8')).trim(),eventKey:(await readFile('/run/s01-inngest-event-key','utf8')).trim()},async()=>({operationId:null,disposition:'ignored'}));
    await engine.client.send({id:'${fixture.eventId}',name:'agency.creation-accepted',data:{schemaVersion:1,agencyId:'${fixture.agencyId}',resourceId:'${fixture.rootId}',version:'1'}});console.log('SENT');
   `]);
            await expect.poll(async () => {
                try {
                    return await docker(['exec', provisioner, 'cat', '/tmp/t06-before-ack']);
                }
                catch {
                    return 'WAIT';
                }
            }, { timeout: 90000, interval: 100 }).toBe('READY');
            await ready(fixture.agencyId);
            const before = await snapshot();
            // The real HTTP callback is still waiting in the provisioner; kill its SDK peer before any response.
            await docker(['kill', '--signal', 'KILL', orchestrator]);
            await docker([...compose, 'start', 't06-orchestrator']);
            await expect.poll(async () => {
                try {
                    return await docker(['exec', orchestrator, '/s01-node', '--input-type=module', '-e',
                        "console.log((await fetch('http://t06-orchestrator:8288/health')).status)"]);
                }
                catch {
                    return 'UNREADY';
                }
            }, { timeout: 20000 }).toBe('200');
            await docker(['exec', provisioner, '/s01-node', '-e', "require('fs').writeFileSync('/tmp/t06-release-ack','release',{mode:0o600})"]);
            await expect.poll(async () => {
                const raw = await docker(['exec', provisioner, 'cat', '/tmp/t06-callbacks.ndjson']);
                return raw.split('\n').map(line => JSON.parse(line) as {
                    disposition: string;
                }).filter(v => v.disposition === 'ignored').length;
            }, { timeout: 150000, interval: 250 }).toBeGreaterThanOrEqual(1);
            const stepHistory = async () => (await history.query(`SELECT h.type,h.step_name,h.attempt FROM history h
    JOIN function_runs f ON f.run_id=h.run_id JOIN events e ON e.internal_id=f.event_id WHERE e.event_id=$1`, [fixture.eventId])).rows;
            await expect.poll(async () => (await stepHistory()).some(h => h.type === 'FunctionCompleted'), { timeout: 30000 }).toBe(true);
            const persisted = await stepHistory();
            expect(persisted.some(h => h.type === 'StepErrored')).toBe(true);
            expect(persisted.some(h => h.type === 'StepScheduled' && h.attempt >= 1)).toBe(true);
            expect(persisted.some(h => h.type === 'StepCompleted' && h.step_name === 'durable-attempt' && h.attempt >= 1)).toBe(true);
            expect((await history.query(`SELECT count(DISTINCT f.run_id)::int AS n FROM function_runs f
    JOIN events e ON e.internal_id=f.event_id WHERE e.event_id=$1`, [fixture.eventId])).rows[0].n).toBe(1);
            expect(await snapshot() === before).toBe(true);
            expect((await central.query('SELECT count(*)::int AS n FROM control.provisioning_execution WHERE operation_id=$1', [fixture.operationId])).rows[0].n).toBe(1);
        }
        finally {
            await central.end();
            await history.end();
        }
    }, 240000);
});
