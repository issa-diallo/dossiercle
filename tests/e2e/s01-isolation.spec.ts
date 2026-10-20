import { expect, test } from '@playwright/test';
import { origin, nativePage, nativePendingInvitation, enrollNative } from '../auth/private-t05-native.js';

test('un identifiant d’agence forgé ne révèle ni état ni infrastructure et ne déclenche aucune mutation', async () => {
  const invitation = await nativePendingInvitation(); const browser = await nativePage(); const writes: string[] = []; const reads: Array<{ route: string; method: string; status?: number; elapsedMs: number }> = []; const sessionScopes: Array<{ scope: string; agencyIdPresent: boolean }> = []; const startedAt = Date.now(); const requestById = new WeakMap<object, typeof reads[number]>();
  try {
    const safeRoute = (url: string) => {
      const path = new URL(url).pathname;
      return path === '/v1/session' || path === '/v1/onboarding/agency' ? path : /^\/v1\/agencies\/[0-9a-f-]+\/activation$/.test(path) ? '/v1/agencies/[agency]/activation' : undefined;
    };
    browser.page.on('request', request => {
      const route = safeRoute(request.url()); if (route) { const record = { route, method: request.method(), elapsedMs: Date.now() - startedAt }; reads.push(record); requestById.set(request, record); }
    });
    browser.page.on('response', response => {
      const route = safeRoute(response.url());
      if (route) { const request = requestById.get(response.request()); if (request) request.status = response.status(); }
      if (route === '/v1/session' && response.status() === 200) void response.json().then((body: unknown) => {
        if (body && typeof body === 'object') { const view = body as { scope?: unknown; agencyId?: unknown }; if (view.scope === 'onboarding' || view.scope === 'agency' || view.scope === 'platform') sessionScopes.push({ scope: view.scope, agencyIdPresent: typeof view.agencyId === 'string' }); }
      }).catch(() => {});
    });
    await enrollNative(browser.page, invitation, () => {});
    browser.page.on('request', request => {
      const path = new URL(request.url()).pathname;
      if (request.method() === 'POST' && path.startsWith('/v1/')) writes.push('POST /v1');
    });
    const foreignId = '0f8fad5b-d9cb-469f-a165-70867728950e';
    const response = await browser.page.evaluate(async id => fetch(`/v1/agencies/${id}/activation`, { credentials: 'same-origin', cache: 'no-store' }).then(value => value.status), foreignId);
    expect([403, 404]).toContain(response);
    await browser.page.goto(origin + '/app/agencies/' + foreignId + '/activation');
    const safeState = async () => browser.page.evaluate(() => {
      const heading = document.querySelector('h1,h2')?.textContent?.trim() ?? '';
      const headings = ['Préparer votre espace', 'Suivre la préparation', 'Votre espace est prêt', 'Votre espace est activé', 'Préparation à vérifier'];
      const alert = document.querySelector('[role="alert"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      const error = alert.includes('Cet espace n’est pas disponible pour cette session.') ? 'ACCESS_DENIED' : alert.includes('session a expiré') ? 'SESSION_EXPIRED' : alert ? 'OTHER_ALERT' : 'NONE';
      let quota: { calls: number; polls: number; oldestAgeMs: number | null; newestAgeMs: number | null; blockedMs: number | null } | null = null;
      try {
        const raw = sessionStorage.getItem('dossiercle:t05-client-quota:v1'); const cooldownRaw = sessionStorage.getItem('dossiercle:bootstrap-cooldown:v1'); let blockedMs: number | null = null;
        if (cooldownRaw) { const cooldown = JSON.parse(cooldownRaw) as { blockedUntil?: unknown }; if (Number.isSafeInteger(cooldown.blockedUntil)) blockedMs = Math.max(0, (cooldown.blockedUntil as number) - Date.now()); }
        if (raw) { const q = JSON.parse(raw) as { calls?: unknown; polls?: unknown }; if (Array.isArray(q.calls) && Array.isArray(q.polls) && q.calls.every(Number.isSafeInteger)) { const ages = (q.calls as number[]).map(at => Math.max(0, Date.now() - at)); quota = { calls: ages.length, polls: q.polls.length, oldestAgeMs: ages.length ? Math.max(...ages) : null, newestAgeMs: ages.length ? Math.min(...ages) : null, blockedMs }; } }
      } catch { quota = null; }
      const route = location.pathname === '/app/onboarding' ? '/app/onboarding' : /^\/app\/agencies\/[0-9a-f-]+\/activation$/.test(location.pathname) ? '/app/agencies/[agency]/activation' : 'OTHER';
      return { route, heading: headings.includes(heading) ? heading : 'OTHER', busy: document.querySelector('main')?.getAttribute('aria-busy') === 'true', shell: Boolean(document.querySelector('.shell')), error, quota };
    });
    try { await expect(browser.page.getByText('Cet espace n’est pas disponible pour cette session.')).toBeVisible(); }
    catch {
      const initial = { ui: await safeState(), reads: [...reads] };
      await browser.page.waitForFunction(() => document.querySelector('main')?.getAttribute('aria-busy') !== 'true', undefined, { timeout: 30_000 }).catch(() => undefined);
      const settled = { ui: await safeState(), reads: [...reads] };
      if (!await browser.page.getByText('Cet espace n’est pas disponible pour cette session.').isVisible().catch(() => false)) throw new Error('SAFE_ISOLATION_SETTLE_DIAGNOSTIC ' + JSON.stringify({ initial, settled, sessions: sessionScopes }));
    }
    await browser.page.reload();
    await expect(browser.page.getByText('Cet espace n’est pas disponible pour cette session.')).toBeVisible();
    expect(writes).toEqual([]);
    const text = await browser.page.locator('body').innerText();
    expect(text).not.toMatch(/postgres|journal|worker|fencing|secret|coordinator/i);
  } finally { await browser.context.close(); }
});
