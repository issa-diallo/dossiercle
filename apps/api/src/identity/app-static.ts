import { lstatSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import type { Request, Response } from 'express';

const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'";
const HTML_ROUTES = new Set(['/app/onboarding']);
const ACTIVATION_ROUTE = /^\/app\/agencies\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/activation$/i;
const ASSET_ROUTE = /^\/app\/assets\/[A-Za-z0-9_-]+-[A-Za-z0-9_-]{8,}\.(?:js|css)$/i;

export function serveAppStatic(request: Request, response: Response, root: string, host: string): boolean {
  const raw = request.url ?? '';
  if (!raw.startsWith('/app/')) return false;
  if (request.headers.host !== host || !['GET', 'HEAD'].includes(request.method ?? '') || /[%?#\\\0]/.test(raw)
    || raw.split('/').some(part => part === '.' || part === '..')) {
    response.status(404).end();
    return true;
  }
  const html = HTML_ROUTES.has(raw) || ACTIVATION_ROUTE.test(raw);
  const asset = ASSET_ROUTE.test(raw);
  if (!html && !asset) {
    response.status(404).end();
    return true;
  }
  const path = resolve(root, html ? 'index.html' : `.${raw.slice('/app'.length)}`);
  const normalizedRoot = resolve(root);
  if (path !== normalizedRoot && !path.startsWith(normalizedRoot + sep)) {
    response.status(404).end();
    return true;
  }
  try {
    const metadata = lstatSync(path);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error('NOT_FILE');
    const body = readFileSync(path);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', CSP);
    response.setHeader('Content-Type', html ? 'text/html; charset=utf-8' : raw.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8');
    response.setHeader('Content-Length', body.byteLength);
    response.status(200);
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.status(404).end();
  }
  return true;
}
