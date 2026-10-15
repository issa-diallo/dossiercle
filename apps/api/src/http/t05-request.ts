import type { IncomingMessage } from 'node:http';
import { IdempotencyKey, IfMatch, UUID } from '@dossiercle/contracts';

export class T05RequestClosed extends Error {
  constructor(readonly status: 400 | 404 | 429, readonly retryAfter?: number) {
    super(status === 429 ? 'RATE_LIMITED' : status === 404 ? 'NOT_FOUND' : 'INVALID_REQUEST');
  }
}
const invalid = (): never => { throw new T05RequestClosed(400); };
export const T05_BODY_LIMIT = 32 * 1024;

/** Decode UTF8 and reject duplicate decoded keys, including escaped aliases. */
export function strictT05Json(bytes: Uint8Array): unknown {
  if (bytes.byteLength > T05_BODY_LIMIT) invalid();
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); } catch { return invalid(); }
  let offset = 0;
  const white = () => { while (/[\t\n\r ]/.test(text[offset] ?? '\0')) offset++; };
  const string = (): string => {
    const match = /^"(?:[^"\\\x00-\x1f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"/.exec(text.slice(offset));
    if (!match) return invalid();
    offset += match[0].length;
    return JSON.parse(match[0]) as string;
  };
  const value = (depth: number): void => {
    if (depth > 32) invalid();
    white();
    const first = text[offset];
    if (first === '{' || first === '[') {
      const object = first === '{', close = object ? '}' : ']';
      const keys = new Set<string>(); offset++; white();
      if (text[offset] === close) { offset++; return; }
      for (;;) {
        white();
        if (object) {
          const key = string();
          if (keys.has(key)) invalid();
          keys.add(key); white();
          if (text[offset++] !== ':') invalid();
        }
        value(depth + 1); white();
        if (text[offset] === close) { offset++; return; }
        if (text[offset++] !== ',') invalid();
      }
    }
    if (first === '"') { string(); return; }
    const primitive = /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(text.slice(offset));
    if (!primitive) invalid();
    offset += primitive![0].length;
    const parsed: unknown = JSON.parse(primitive![0]);
    if (typeof parsed === 'number' && !Number.isFinite(parsed)) invalid();
  };
  try { value(0); white(); if (offset !== text.length) invalid(); return JSON.parse(text) as unknown; }
  catch { return invalid(); }
}

/** rawHeaders preserves duplicate fields that Node's normalized headers may merge. */
export function t05Header(request: Pick<IncomingMessage, 'rawHeaders'>, name: string, required = true): string | undefined {
  const values: string[] = [];
  for (let i = 0; i < request.rawHeaders.length; i += 2) {
    if (request.rawHeaders[i]!.toLowerCase() === name.toLowerCase()) values.push(request.rawHeaders[i + 1]!);
  }
  if (values.length > 1 || (required && values.length !== 1)) invalid();
  return values[0];
}

export async function readT05Body<T>(request: IncomingMessage, schema: { parse(value: unknown): T }): Promise<T> {
  const contentType = t05Header(request, 'content-type');
  if (contentType !== 'application/json' && contentType !== 'application/json; charset=utf-8') invalid();
  const length = t05Header(request, 'content-length', false);
  const transfer = t05Header(request, 'transfer-encoding', false);
  if (length && transfer) invalid();
  if (transfer && transfer !== 'chunked') invalid();
  if (length !== undefined && (!/^(?:0|[1-9][0-9]*)$/.test(length) || Number(length) > T05_BODY_LIMIT)) invalid();
  const chunks: Buffer[] = []; let size = 0;
  try {
    for await (const raw of request) {
      const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as Uint8Array);
      size += chunk.length;
      if (size > T05_BODY_LIMIT) invalid();
      chunks.push(chunk);
    }
  } catch { return invalid(); }
  if (length !== undefined && Number(length) !== size) invalid();
  try { return schema.parse(strictT05Json(Buffer.concat(chunks))); } catch { return invalid(); }
}

export function t05MutationHeaders(request: Pick<IncomingMessage, 'rawHeaders'>,
  options: { idempotent: boolean; versioned: boolean }) {
  const origin = t05Header(request, 'origin'), csrf = t05Header(request, 'x-csrf-token');
  if (!origin || !csrf || !/^[A-Za-z0-9_-]{43}$/.test(csrf)) invalid();
  const key = t05Header(request, 'idempotency-key', options.idempotent);
  const version = t05Header(request, 'if-match', options.versioned);
  try {
    return { origin, csrf, key: key === undefined ? undefined : IdempotencyKey.parse(key).toLowerCase(),
      version: version === undefined ? undefined : IfMatch.parse(version) };
  } catch { return invalid(); }
}

export function t05Uuid(value: string): string {
  try { return UUID.parse(value).toLowerCase(); } catch { throw new T05RequestClosed(404); }
}

/** One instance per IP/session category; no active bucket is evicted to admit a new key. */
export class T05RateLimiter {
  private readonly buckets = new Map<string, { until: number; count: number }>();
  constructor(private readonly limit: number, private readonly now = Date.now) {}
  take(key: string): void {
    const now = this.now();
    for (const [id, bucket] of this.buckets) if (bucket.until <= now) this.buckets.delete(id);
    let bucket = this.buckets.get(key);
    if (!key || key.length > 256 || (!bucket && this.buckets.size >= 100)) throw new T05RequestClosed(429, 60);
    if (!bucket) { bucket = { until: now + 60_000, count: 0 }; this.buckets.set(key, bucket); }
    if (bucket.count >= this.limit) throw new T05RequestClosed(429, Math.min(60, Math.max(1, Math.ceil((bucket.until - now) / 1000))));
    bucket.count++;
  }
}
