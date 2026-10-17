import { request } from 'node:https';
import { z } from 'zod';
const result = z.strictObject({ operationId: z.uuid().nullable(),
    disposition: z.enum(['closed', 'busy', 'blocked', 'ignored']) });
export function provisionerWake(tls: {
    key: Buffer;
    cert: Buffer;
    ca: Buffer;
}) {
    return async (eventId: string) => new Promise<z.infer<typeof result>>((resolve, reject) => {
        const body = JSON.stringify({ eventId: z.uuid().parse(eventId) });
        const req = request({ host: 't06-provisioner', port: 4443, servername: 't06-provisioner',
            method: 'POST', path: '/internal/t06/wake', rejectUnauthorized: true, agent: false, ...tls,
            headers: { Host: 't06-provisioner:4443', 'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body) } }, res => {
            const chunks: Buffer[] = [];
            let length = 0;
            res.on('data', (chunk: Buffer) => {
                length += chunk.length;
                if (length > 4096)
                    req.destroy(new Error('PROVISIONER_RESPONSE_REFUSED'));
                else
                    chunks.push(chunk);
            });
            res.once('aborted', () => reject(new Error('PROVISIONER_UNAVAILABLE')));
            res.once('error', () => reject(new Error('PROVISIONER_UNAVAILABLE')));
            res.once('end', () => {
                try {
                    if (res.statusCode !== 200)
                        throw new Error('PROVISIONER_UNAVAILABLE');
                    resolve(result.parse(JSON.parse(Buffer.concat(chunks).toString('utf8'))));
                }
                catch {
                    reject(new Error('PROVISIONER_UNAVAILABLE'));
                }
            });
        });
        const deadline = setTimeout(() => req.destroy(new Error('PROVISIONER_UNAVAILABLE')), 60000);
        deadline.unref();
        req.once('close', () => clearTimeout(deadline));
        req.setTimeout(60000, () => req.destroy(new Error('PROVISIONER_UNAVAILABLE')));
        req.once('error', () => reject(new Error('PROVISIONER_UNAVAILABLE')));
        req.end(body);
    });
}
