import { createServer } from 'node:https';
import type { TLSSocket } from 'node:tls';
import { z } from 'zod';
import type { ProvisioningService, WakeResult } from './provisioning.service.js';
import type { ActivationAuditService } from './activation-audit.service.js';
const wakeBody = z.strictObject({ eventId: z.uuid() });
const activationBody = z.strictObject({ reservationId: z.uuid(), eventId: z.uuid() });
export function provisionerServer(service: ProvisioningService, tls: {
    key: Buffer;
    cert: Buffer;
    ca: Buffer;
}, afterWake?: (eventId: string, result: WakeResult) => Promise<void>, activationAudit?:ActivationAuditService) {
    const server = createServer({ ...tls, minVersion: 'TLSv1.2', requestCert: true, rejectUnauthorized: true }, async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        const socket = req.socket as TLSSocket;
        const peer=socket.getPeerCertificate();
        const isOrchestrator=peer.subject?.CN==='t06-orchestrator'&&peer.subjectaltname==='DNS:t06-orchestrator';
        const isActivation=peer.subject?.CN==='t07-activation'&&peer.subjectaltname==='DNS:t07-activation';
        const allowedRoute=(isOrchestrator&&['/internal/t06/wake','/internal/t07/activation/project'].includes(req.url??''))
            ||(isActivation&&['/internal/t07/activation/prepare','/internal/t07/activation/read'].includes(req.url??''));
        if (!socket.authorized || !allowedRoute || req.headers.host !== 't06-provisioner:4443' || req.method !== 'POST'
            || req.headers['content-type'] !== 'application/json' || !activationAudit&&req.url?.startsWith('/internal/t07/')) {
            res.writeHead(403).end();
            req.resume();
            return;
        }
        try {
            const chunks: Buffer[] = [];
            let length = 0;
            for await (const chunk of req) {
                const bytes = Buffer.from(chunk);
                length += bytes.length;
                if (length > 4096) {
                    res.writeHead(413).end();
                    req.destroy();
                    return;
                }
                chunks.push(bytes);
            }
            const raw=JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
            let result:unknown;
            if(req.url==='/internal/t06/wake'){
                const body=wakeBody.parse(raw);const wakeResult=await service.wake(body.eventId);
                await afterWake?.(body.eventId,wakeResult);result=wakeResult;
            }else if(req.url==='/internal/t07/activation/prepare'){
                const body=activationBody.parse(raw);await activationAudit!.prepare(body.reservationId,body.eventId);result={prepared:true};
            }else if(req.url==='/internal/t07/activation/read'){
                const body=activationBody.parse(raw);result=await activationAudit!.read(body.reservationId,body.eventId);
            }else{
                const body=wakeBody.parse(raw);await activationAudit!.project(body.eventId);result={projected:true};
            }
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(200).end(JSON.stringify(result));
        }
        catch {
            if (!res.headersSent)
                res.writeHead(400).end();
            else
                res.destroy();
        }
    });
    server.requestTimeout = 15000;
    server.headersTimeout = 10000;
    server.timeout = 60000;
    server.maxHeadersCount = 32;
    server.maxConnections = 4;
    return server;
}
