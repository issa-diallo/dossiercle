import https from 'node:https';
import type { FetchBody } from 'openid-client';
type NativeInit = { headers?: HeadersInit | undefined; method?: string | undefined; body?: FetchBody; signal?: AbortSignal | null | undefined };
import { readFileSync } from 'node:fs';

/** Fixed service route. No redirects, proxy environment, URL-derived destination or logs. */
export function nativeTransport(options: {
    advertisedOrigin: string; host: string; port: number; serverName: string; caFile: string; deadlineMs?: number; responseLimitBytes?: number; clientCertificateFile?: string; clientKeyFile?: string; browserRedirects?: boolean;
}) {
  const origin = new URL(options.advertisedOrigin).origin;
  if (!origin.startsWith('https://')) throw new Error('TLS_REQUIRED');
  const deadlineMs = options.deadlineMs ?? 10_000;
  if (!Number.isInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 10_000) throw new Error('INVALID_NATIVE_DEADLINE');
  const responseLimit=options.responseLimitBytes??1024*1024;
  if(!Number.isInteger(responseLimit)||responseLimit<1||responseLimit>2*1024*1024)throw new Error('INVALID_NATIVE_RESPONSE_LIMIT');
  const ca = readFileSync(options.caFile);
  if(Boolean(options.clientCertificateFile)!==Boolean(options.clientKeyFile))throw new Error('INVALID_NATIVE_CLIENT_IDENTITY');
  const cert=options.clientCertificateFile?readFileSync(options.clientCertificateFile):undefined;
  const key=options.clientKeyFile?readFileSync(options.clientKeyFile):undefined;
  return async (input: string | URL | Request, init?: NativeInit): Promise<Response> => {
    if (input instanceof Request) throw new Error('UNSUPPORTED_NATIVE_REQUEST');
    const url = new URL(input);
    if (url.origin !== origin || url.username || url.password || url.hash) throw new Error('NATIVE_DESTINATION_REJECTED');
    const headers = new Headers(init?.headers);
    headers.set('Host', url.host);
    headers.set('Connection', 'close');
    const body = init?.body;
    if (body !== undefined && body !== null && typeof body !== 'string' && !(body instanceof URLSearchParams)) {
      throw new Error('UNSUPPORTED_NATIVE_BODY');
    }
    const encoded = body == null ? undefined : body.toString();
    if (encoded !== undefined) headers.set('Content-Length', String(Buffer.byteLength(encoded)));
    return await new Promise<Response>((resolve, reject) => {
      const request = https.request({
        hostname: options.host, port: options.port, servername: options.serverName,
        ca, cert, key, rejectUnauthorized: true, agent: false, method: init?.method ?? 'GET',
        path: url.pathname + url.search, headers: Object.fromEntries(headers),
        timeout: 10_000,
      }, response => {
        const chunks: Buffer[] = []; let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > responseLimit) request.destroy(new Error('NATIVE_RESPONSE_TOO_LARGE'));
          else chunks.push(chunk);
        });
        response.on('error', () => reject(new Error('DEPENDENCY_UNAVAILABLE')));
        response.on('end', () => {
          const status = response.statusCode ?? 503;
          if (status >= 300 && status < 400) {
            if (!options.browserRedirects || !response.headers.location) return reject(new Error('NATIVE_REDIRECT_REJECTED'));
            const location = new URL(response.headers.location, url);
            if (location.origin !== origin || location.username || location.password || location.hash
              || !/^\/(?:realms\/dossiercle\/|v1\/auth\/(?:oidc\/callback|enrollment\/complete|bootstrap\/reauth\/callback)$)/.test(location.pathname)) {
              return reject(new Error('NATIVE_REDIRECT_REJECTED'));
            }
          }
          const responseHeaders = new Headers();
          for (const [key, value] of Object.entries(response.headers)) {
            if (value !== undefined) {
              if (key === 'set-cookie' && Array.isArray(value)) for (const cookie of value) responseHeaders.append(key, cookie);
              else responseHeaders.set(key, Array.isArray(value) ? value.join(',') : value);
            }
          }
          resolve(new Response([204, 205, 304].includes(status) ? null : Buffer.concat(chunks), { status, headers: responseHeaders }));
        });
      });
      request.on('error', () => reject(new Error('DEPENDENCY_UNAVAILABLE')));
      request.on('timeout', () => request.destroy(new Error('DEPENDENCY_UNAVAILABLE')));
      // Socket inactivity is insufficient when a peer keeps trickling bytes.
      const deadline = setTimeout(() => request.destroy(new Error('DEPENDENCY_UNAVAILABLE')), deadlineMs);
      deadline.unref();
      request.once('close', () => clearTimeout(deadline));
      if (init?.signal) {
        const abort = () => request.destroy(new Error('DEPENDENCY_UNAVAILABLE'));
        if (init.signal.aborted) abort();
        else init.signal.addEventListener('abort', abort, { once: true });
        request.once('close', () => init.signal?.removeEventListener('abort', abort));
      }
      request.end(encoded);
    });
  };
}
