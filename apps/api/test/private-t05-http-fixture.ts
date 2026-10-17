import 'reflect-metadata';
import { request as nodeRequest } from 'node:http';
import { NestFactory } from '@nestjs/core';
import type { ArgumentsHost } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PlatformModule } from '../src/platform/platform.module.js';
import { AgenciesModule } from '../src/agencies/agencies.module.js';
import { T05HttpBoundary, isT05Namespace, isT05Route, sendT05Error } from '../src/http/t05-boundary.js';
import { T05RequestClosed } from '../src/http/t05-request.js';
import { fixture, origin } from './private-t05-fixture.js';
export async function httpFixture() {
    const f = await fixture(), boundary = new T05HttpBoundary();
    const app = await NestFactory.create({ module: class T05HttpFixture {
        }, imports: [
            PlatformModule.register({ invitations: f.service, boundary }), AgenciesModule.register({ service: f.agencies, boundary })
        ],
    }, { logger: false, bodyParser: false });
    app.useGlobalFilters({ catch(error: unknown, host: ArgumentsHost) { sendT05Error(error, host.switchToHttp().getResponse<Response>()); } });
    app.use((req: Request, res: Response, next: () => void) => {
        res.setHeader('Cache-Control', 'no-store');
        if (isT05Namespace(req.originalUrl) && !isT05Route(req.method, req.originalUrl)) {
            sendT05Error(new T05RequestClosed(404), res);
            return;
        }
        next();
    });
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as {
        port: number;
    };
    const send = (method: string, path: string, body?: string | Buffer, headers: Record<string, string> | string[] = {}) => new Promise<{
        status: number;
        headers: Record<string, unknown>;
        body: unknown;
    }>((resolve, reject) => {
        const rawHeaders = ['Host', '127.0.0.1:' + address.port, ...(Array.isArray(headers) ? headers : Object.entries(headers).flat())];
        const req = nodeRequest({ hostname: '127.0.0.1', port: address.port, path, method, headers: rawHeaders }, res => {
            let raw = '';
            res.on('data', chunk => { raw += String(chunk); });
            res.on('error', reject);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode!, headers: res.headers, body: raw ? JSON.parse(raw) : null });
                }
                catch {
                    reject(new Error('SYNTHETIC_HTTP_RESPONSE_NOT_JSON'));
                }
            });
        });
        req.on('error', reject);
        req.end(body);
    });
    const headers = (command: ReturnType<typeof f.request>) => ({ cookie: command.cookie!, 'content-type': 'application/json', origin,
        'x-csrf-token': command.csrf!, 'idempotency-key': command.key, ...(command.version === undefined ? {} : { 'if-match': `"${command.version}"` }) });
    return { ...f, app, send, headers };
}
