import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serveAppStatic } from '../src/identity/app-static.js';

const host = 'localhost:38857';
function request(url: string, method = 'GET', requestHost = host) { return { url, method, headers: { host: requestHost } } as never; }
function response() {
  const headers = new Map<string, unknown>(); let statusCode = 200; let body: unknown;
  const value = { setHeader: (name: string, entry: unknown) => headers.set(name.toLowerCase(), entry), status: (code: number) => { statusCode = code; return value; }, end: (data?: unknown) => { body = data; return value; } };
  return { value: value as never, headers, status: () => statusCode, body: () => body };
}
describe('same-origin UI static boundary', () => {
  let root = '';
  afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); root = ''; });
  it('serves only the built entry and hashed assets with an isolated strict policy', () => {
    root = mkdtempSync(join(tmpdir(), 's01-app-')); mkdirSync(join(root, 'assets'));
    writeFileSync(join(root, 'index.html'), '<html><script src="/app/assets/index-Bga6eDVs.js"></script></html>');
    writeFileSync(join(root, 'assets', 'index-Bga6eDVs.js'), 'window.app = true');
    const page = response(); expect(serveAppStatic(request('/app/onboarding'), page.value, root, host)).toBe(true);
    expect(page.status()).toBe(200); expect((page.body() as Buffer).toString()).toContain('html');
    expect(page.headers.get('content-security-policy')).toBe("default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'");
    expect(page.headers.get('cache-control')).toBe('no-store'); expect(page.headers.get('referrer-policy')).toBe('no-referrer');
    const file = response(); serveAppStatic(request('/app/assets/index-Bga6eDVs.js'), file.value, root, host);
    expect(file.status()).toBe(200); expect(file.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
  });
  it.each([
    ['/app/other', 'GET', host], ['/app/onboarding?returnTo=/', 'GET', host], ['/app/%2e%2e/private', 'GET', host], ['/app/assets/index.abcdef012345.js', 'GET', host],
    ['/app/onboarding', 'POST', host], ['/app/onboarding', 'GET', 'evil.example'], ['/app/assets/unknown.js', 'GET', host],
  ])('refuses unlisted path/method/host %s', (url, method, requestHost) => {
    root = mkdtempSync(join(tmpdir(), 's01-app-')); const res = response();
    expect(serveAppStatic(request(url, method, requestHost), res.value, root, host)).toBe(true); expect(res.status()).toBe(404);
  });
  it('supports HEAD without returning the HTML body and leaves unrelated routes to the existing router', () => {
    root = mkdtempSync(join(tmpdir(), 's01-app-')); writeFileSync(join(root, 'index.html'), 'html');
    const head = response(); serveAppStatic(request('/app/agencies/0f8fad5b-d9cb-469f-a165-70867728950e/activation', 'HEAD'), head.value, root, host);
    expect(head.status()).toBe(200); expect(head.body()).toBeUndefined();
    expect(serveAppStatic(request('/v1/session'), response().value, root, host)).toBe(false);
  });
});
