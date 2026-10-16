import { createServer } from 'node:https';
import type { TLSSocket } from 'node:tls';
import { z } from 'zod';
import type { ProvisioningService, WakeResult } from './provisioning.service.js';
const wakeBody = z.strictObject({ eventId: z.uuid() });
export function provisionerServer(service: ProvisioningService, tls: {
    key: Buffer;
    cert: Buffer;
    ca: Buffer;
}, afterWake?: (eventId: string, result: WakeResult) => Promise<void>) {
    const server = createServer({ ...tls, minVersion: 'TLSv1.2', requestCert: true, rejectUnauthorized: true }, async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        const socket = req.socket as TLSSocket;
        if (!socket.authorized || socket.getPeerCertificate().subject?.CN !== 't06-orchestrator'
            || req.headers.host !== 't06-provisioner:4443' || req.method !== 'POST'
            || req.url !== '/internal/t06/wake' || req.headers['content-type'] !== 'application/json') {
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
            const body = wakeBody.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
            const result = await service.wake(body.eventId);
            await afterWake?.(body.eventId, result);
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
