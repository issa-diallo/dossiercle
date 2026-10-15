import { Readable } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';
import { CreateAgency } from '@dossiercle/contracts';
import { strictT05Json, readT05Body, t05Header, t05MutationHeaders, T05RateLimiter, t05Uuid } from '../src/http/t05-request.js';

const bytes = (value: string) => Buffer.from(value);
const request = (body: string | Buffer[], headers = ['Content-Type', 'application/json']): IncomingMessage =>
  Object.assign(Readable.from(typeof body === 'string' ? [bytes(body)] : body), { rawHeaders: headers }) as IncomingMessage;
describe('strict bounded T05 JSON/HTTP', () => {
  it.each(['{"a":1,"a":2}', '{"a":1,"\\u0061":2}', '{"nested":{"x":1,"x":2}}',
    '{"a":1,}', '[1,]', '{} {}', '01', '1e999', '{"x":undefined}', '', ' '.repeat(5)])('refuses ambiguous/invalid JSON %j', value => {
    expect(() => strictT05Json(bytes(value))).toThrow('INVALID_REQUEST');
  });
  it('parses distinct keys, arrays and escaped strings without interpreting their content', () => {
    const value = { nested: [{ a: 'quote"comma,:unicodeé' }], b: [true, false, null, -1.2e3] };
    expect(strictT05Json(bytes(JSON.stringify(value)))).toEqual(value);
    expect(() => strictT05Json(Buffer.from([0xc0, 0xaf]))).toThrow('INVALID_REQUEST');
    expect(() => strictT05Json(bytes('['.repeat(34) + '0' + ']'.repeat(34)))).toThrow('INVALID_REQUEST');
  });
  it('enforces raw bytes and object contract across streamed chunks', async () => {
    await expect(readT05Body(request([bytes('{"na'), bytes('me":" Agence A "}')]), CreateAgency)).resolves.toEqual({ name: 'Agence A' });
    for (const value of ['[]', 'null', '{"name":"A","subjectId":"forged"}', '{"name":"' + 'é'.repeat(17000) + '"}']) {
      await expect(readT05Body(request(value), CreateAgency)).rejects.toThrow('INVALID_REQUEST');
    }
    await expect(readT05Body(request([Buffer.alloc(32000, 32), Buffer.alloc(1000, 32)]), CreateAgency)).rejects.toThrow('INVALID_REQUEST');
  });
  it.each([
    ['Content-Type', 'text/json'], ['Content-Type', 'application/json', 'content-type', 'application/json'],
    ['Content-Type', 'application/json', 'Content-Length', '40000'],
    ['Content-Type', 'application/json', 'Content-Length', '02'],
    ['Content-Type', 'application/json', 'Content-Length', '1'],
    ['Content-Type', 'application/json', 'Content-Length', '2', 'Transfer-Encoding', 'chunked'],
  ])('refuses ambiguous framing/header %j', async (...headers) => {
    await expect(readT05Body(request('{}', headers), CreateAgency)).rejects.toThrow('INVALID_REQUEST');
  });
  it('checks headers without trusting normalized duplicates or weak ETags', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    const rawHeaders = ['Origin', 'https://localhost:1234', 'X-CSRF-Token', 'a'.repeat(43), 'Idempotency-Key', id, 'If-Match', '"2"'];
    expect(t05MutationHeaders({ rawHeaders }, { idempotent: true, versioned: true })).toMatchObject({ key: id, version: 2n });
    expect(() => t05Header({ rawHeaders: ['Origin', 'a', 'origin', 'a'] }, 'origin')).toThrow();
    expect(() => t05MutationHeaders({ rawHeaders: [...rawHeaders.slice(0, -1), 'W/"2"'] }, { idempotent: true, versioned: true })).toThrow();
    expect(t05Uuid(id.toUpperCase())).toBe(id);
    expect(() => t05Uuid('bad')).toThrow('NOT_FOUND');
  });
  it('bounds each bucket, active keys and TTL without evicting accepted sessions', () => {
    let now = 0;
    const sessions = new T05RateLimiter(10, () => now), ips = new T05RateLimiter(60, () => now);
    for (let i = 0; i < 10; i++) sessions.take('session');
    expect(() => sessions.take('session')).toThrow('RATE_LIMITED');
    for (let i = 0; i < 60; i++) ips.take('127.0.0.1');
    expect(() => ips.take('127.0.0.1')).toThrow('RATE_LIMITED');
    for (let i = 0; i < 99; i++) sessions.take('other-' + i);
    expect(() => sessions.take('overflow')).toThrow('RATE_LIMITED');
    now = 60_000;
    expect(() => sessions.take('overflow')).not.toThrow();
  });
});
