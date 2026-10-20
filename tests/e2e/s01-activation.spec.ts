import { expect, test, type Page } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { e, origin, nativePage, nativePendingInvitation, enrollNative } from '../auth/private-t05-native.js';
import { captureCreatedAgency, declareCreateIntent, expireNativeBffSession, markAgencyFailedFixture } from './private-s01-fixture.js';

const run = promisify(execFile);
type SafeFlowRequest = { method: string; route: string; status?: number; elapsedMs: number };
type SafeFlowProbe = { requests: SafeFlowRequest[]; requestById: WeakMap<object, SafeFlowRequest>; session: { scope: string; agencyIdPresent: boolean; requestIndex: number }[]; startedAt: number };
function observeSafeFlow(page: Page): SafeFlowProbe {
  const probe: SafeFlowProbe = { requests: [], requestById: new WeakMap(), session: [], startedAt: Date.now() };
  const safeRoute = (url: string) => {
    const path = new URL(url).pathname;
    if (path === '/v1/session' || path === '/v1/onboarding/agency' || path === '/v1/onboarding/invitation/claim' || path === '/v1/agencies') return path;
    if (/^\/v1\/agencies\/[0-9a-f-]+\/activation$/.test(path)) return '/v1/agencies/[agency]/activation';
    return undefined;
  };
  page.on('request', request => {
    const route = safeRoute(request.url());
    if (route) { const record = { method: request.method(), route, elapsedMs: Date.now() - probe.startedAt }; probe.requests.push(record); probe.requestById.set(request, record); }
  });
  page.on('response', response => {
    const route = safeRoute(response.url());
    if (!route) return;
    const request = probe.requestById.get(response.request());
    if (request) request.status = response.status();
    if (route === '/v1/session' && response.status() === 200) {
      const requestIndex = request ? probe.requests.indexOf(request) : -1;
      void response.json().then((body: unknown) => {
        if (body && typeof body === 'object') {
          const view = body as { scope?: unknown; agencyId?: unknown };
          if (requestIndex >= 0 && (view.scope === 'onboarding' || view.scope === 'agency' || view.scope === 'platform')) probe.session.push({ scope: view.scope, agencyIdPresent: typeof view.agencyId === 'string', requestIndex });
        }
      }).catch(() => {});
    }
  });
  return probe;
}
async function safeFlowSnapshot(page: Page, probe: SafeFlowProbe) {
  const browserState = await page.evaluate(() => {
    const heading = document.querySelector('h1,h2')?.textContent?.trim() ?? '';
    const allowedHeadings = ['Préparer votre espace', 'Suivre la préparation', 'Votre espace est prêt', 'Votre espace est activé', 'Préparation à vérifier'];
    const alert = document.querySelector('[role="alert"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const error = alert.includes('Cet espace n’est pas disponible pour cette session.') ? 'ACCESS_DENIED'
      : alert.includes('session a expiré') ? 'SESSION_EXPIRED'
      : alert.includes('Trop de vérifications ont été effectuées. Attendez avant de vérifier à nouveau.') ? 'LOCAL_QUOTA'
      : alert.includes('Impossible de vérifier') ? 'REQUEST_FAILED'
      : alert.includes('La vérification a été interrompue') ? 'POLL_INTERRUPTED'
      : alert ? 'OTHER_ALERT' : 'NONE';
    let quota: { calls: number; polls: number; oldestAgeMs: number | null; newestAgeMs: number | null } | null = null;
    try {
      const raw = sessionStorage.getItem('dossiercle:t05-client-quota:v1');
      if (raw) {
        const value = JSON.parse(raw) as { calls?: unknown; polls?: unknown };
        if (Array.isArray(value.calls) && Array.isArray(value.polls) && value.calls.every(item => Number.isSafeInteger(item))) {
          const ages = (value.calls as number[]).map(at => Math.max(0, Date.now() - at));
          quota = { calls: ages.length, polls: value.polls.length, oldestAgeMs: ages.length ? Math.max(...ages) : null, newestAgeMs: ages.length ? Math.min(...ages) : null };
        }
      }
    } catch { quota = null; }
    const route = location.pathname === '/app/onboarding' ? '/app/onboarding' : /^\/app\/agencies\/[0-9a-f-]+\/activation$/.test(location.pathname) ? '/app/agencies/[agency]/activation' : 'OTHER';
    return { route, heading: allowedHeadings.includes(heading) ? heading : 'OTHER', error, quota };
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  return { ...browserState, requests: probe.requests, sessions: probe.session };
}
async function expectVisibleAfterSafeSettle(page: Page, locator: ReturnType<Page['getByRole']>, probe: SafeFlowProbe): Promise<void> {
  try { await expect(locator).toBeVisible(); }
  catch {
    const initial = await safeFlowSnapshot(page, probe);
    await page.waitForFunction(() => document.querySelector('main')?.getAttribute('aria-busy') !== 'true', undefined, { timeout: 30_000 }).catch(() => undefined);
    const settled = await safeFlowSnapshot(page, probe);
    if (await locator.isVisible().catch(() => false)) return;
    throw new Error('SAFE_FLOW_SETTLE_DIAGNOSTIC ' + JSON.stringify({ initial, settled }));
  }
}
async function uiReauthenticate(page: Page, invitation: { subject: string; contact: string }, credentials: { password: string; recoveryCodes: readonly string[] }) {
  try {
  await page.getByLabel('Adresse e-mail du compte').fill(invitation.contact);
  await page.getByRole('button', { name: 'Se reconnecter' }).click();
  await page.locator('#username').waitFor({ timeout: 30_000 });
  await page.locator('#username').fill(invitation.subject);
  await fillCredential(page, '#password', credentials.password);
  await page.locator('button[type="submit"],input[type="submit"]').first().click();
  const recovery = page.locator('#recoveryCodeInput'); await recovery.waitFor();
  const label = await page.locator('label[for="recoveryCodeInput"]').innerText();
  const index = Number(label.match(/#(\d+)/)?.[1]); const code = credentials.recoveryCodes[index - 1];
  if (!code) throw new Error('NATIVE_RECOVERY_FIXTURE_UNAVAILABLE');
  await fillCredential(page, '#recoveryCodeInput', code);
  await page.locator('button[type="submit"],input[type="submit"]').first().click();
  await page.waitForURL(origin + '/app/onboarding');
  } catch { throw new Error('NATIVE_REAUTHENTICATION_HELPER_FAILED'); }
}
async function fillCredential(page: Page, selector: string, value: string) {
  try { await page.locator(selector).fill(value); } catch { throw new Error('NATIVE_REAUTH_CREDENTIAL_FILL_FAILED'); }
}

test('T08 la reprise après fermeture de session demande une réauthentification native sans mutation métier', async () => {
  test.setTimeout(300_000);
  const subject = randomUUID(); const invitation = await nativePendingInvitation(subject); const browser = await nativePage(); const businessPosts: string[] = [];
  try {
    const credentials = await enrollNative(browser.page, invitation, () => {});
    browser.page.on('request', request => {
      const path = new URL(request.url()).pathname;
      if (request.method() === 'POST' && /^\/v1\/(?:onboarding\/invitation\/claim|agencies(?:\/|$))/.test(path)) businessPosts.push(path);
    });
    const sessionCookie = (await browser.context.cookies(origin)).find(cookie => cookie.name === '__Host-dossiercle');
    if (!sessionCookie) throw new Error('NATIVE_BFF_COOKIE_ABSENT');
    await expireNativeBffSession(sessionCookie.value);
    await browser.context.clearCookies({ name: /^(?:AUTH_SESSION_ID(?:_LEGACY)?|KEYCLOAK_[A-Z_]+|KC_[A-Z_]+)$/ });
    await browser.page.reload();
    await expect(browser.page.getByRole('button', { name: 'Se reconnecter' })).toBeVisible();
    await uiReauthenticate(browser.page, invitation, credentials);
    const current = await browser.page.evaluate(async () => (await fetch('/v1/session', { cache: 'no-store' }).then(response => response.json()) as { scope: string; csrfToken: string }));
    expect(current.scope).toBe('onboarding'); expect(/^[A-Za-z0-9_-]{43}$/.test(current.csrfToken)).toBe(true);
    await expect(browser.page.getByRole('button', { name: 'Continuer avec mon invitation' })).toBeVisible();
    expect(businessPosts).toEqual([]);
  } finally { await browser.context.close(); }
});

test('T08 retrouve la même agence après réauthentification native sur session expirée', async () => {
  test.setTimeout(300_000);
  const subject = randomUUID(); const invitation = await nativePendingInvitation(subject); const browser = await nativePage(); const businessPosts: string[] = [];
  try {
    const credentials = await enrollNative(browser.page, invitation, () => {});
    const probe = observeSafeFlow(browser.page);
    browser.page.on('request', request => {
      const path = new URL(request.url()).pathname;
      if (request.method() === 'POST' && /^\/v1\/(?:onboarding\/invitation\/claim|agencies(?:\/|$))/.test(path)) businessPosts.push(path);
    });
    await browser.page.getByRole('button', { name: 'Continuer avec mon invitation' }).click();
    await browser.page.getByLabel('Nom de l’espace').waitFor();
    await declareCreateIntent(invitation);
    await browser.page.getByLabel('Nom de l’espace').fill('Espace conservé après reconnexion');
    const acceptedResponse = browser.page.waitForResponse(response => new URL(response.url()).pathname === '/v1/agencies' && response.request().method() === 'POST');
    await browser.page.getByRole('button', { name: 'Créer mon espace' }).click();
    const accepted = await acceptedResponse; expect(accepted.status()).toBe(202);
    const created = await accepted.json() as { agencyId: string; operationId: string };
    expect(await captureCreatedAgency()).toMatchObject({ t05: expect.any(Number), t06: expect.any(Number) });
    await expect(browser.page).toHaveURL(new RegExp(`/app/agencies/${created.agencyId}/activation$`));
    const cookie = (await browser.context.cookies(origin)).find(item => item.name === '__Host-dossiercle');
    if (!cookie) throw new Error('NATIVE_BFF_COOKIE_ABSENT');
    await expireNativeBffSession(cookie.value);
    await browser.context.clearCookies({ name: /^(?:AUTH_SESSION_ID(?:_LEGACY)?|KEYCLOAK_[A-Z_]+|KC_[A-Z_]+)$/ });
    await browser.page.reload();
    await browser.page.locator('#activation-error-summary').getByRole('button', { name: 'Retour à la préparation' }).click();
    await expect(browser.page.getByRole('button', { name: 'Se reconnecter' })).toBeVisible();
    const postReauthenticationProbeStart = probe.requests.length;
    await uiReauthenticate(browser.page, invitation, credentials);
    await expect(browser.page).toHaveURL(new RegExp(`/app/agencies/${created.agencyId}/activation$`));
    const session = await browser.page.evaluate(async () => (await fetch('/v1/session', { cache: 'no-store' }).then(response => response.json()) as { scope: string; agencyId: string | null }));
    expect(session).toMatchObject({ scope: 'onboarding', agencyId: null });
    const agencyReadback = await browser.page.evaluate(async () => (await fetch('/v1/onboarding/agency', { cache: 'no-store' }).then(response => response.json()) as { agencyId: string }));
    expect(agencyReadback.agencyId).toBe(created.agencyId);
    await browser.page.waitForFunction(() => {
      const main = document.querySelector('main');
      const heading = document.querySelector('h1#page-title')?.textContent?.trim();
      return Boolean(main && heading === 'Suivre la préparation' && main.getAttribute('aria-busy') !== 'true');
    }, undefined, { timeout: 30_000 });
    const agencyName = browser.page.locator('.agency-name');
    if (!(await agencyName.isVisible().catch(() => false))) {
      await expect(browser.page.locator('#activation-error-summary')).toBeVisible();
      const beforeResume = await safeFlowSnapshot(browser.page, probe);
      expect(beforeResume.quota?.calls).toBe(6);
      const afterReauthentication = () => probe.requests.slice(postReauthenticationProbeStart);
      expect(afterReauthentication().some(request => request.method === 'GET' && request.route === '/v1/agencies/[agency]/activation')).toBe(false);
      expect(afterReauthentication().some(request => request.status === 429)).toBe(false);
      const localDeadline = await browser.page.evaluate(() => {
        try { return (JSON.parse(sessionStorage.getItem('dossiercle:bootstrap-cooldown:v1') ?? 'null') as { blockedUntil?: unknown } | null)?.blockedUntil; }
        catch { return null; }
      });
      expect(typeof localDeadline).toBe('number');
      expect(localDeadline as number).toBeLessThanOrEqual(Date.now() + 60_000);
      await expect(browser.page.locator('#activation-error-summary').getByRole('button', { name: 'Vérifier l’état' })).toBeVisible();
      await browser.page.waitForFunction(() => {
        try {
          const quota = JSON.parse(sessionStorage.getItem('dossiercle:t05-client-quota:v1') ?? 'null') as { calls?: unknown } | null;
          const cooldown = JSON.parse(sessionStorage.getItem('dossiercle:bootstrap-cooldown:v1') ?? 'null') as { blockedUntil?: unknown } | null;
          return Array.isArray(quota?.calls) && quota.calls.filter(at => typeof at === 'number' && Date.now() - at < 60_000).length <= 4
            && typeof cooldown?.blockedUntil === 'number' && cooldown.blockedUntil <= Date.now();
        } catch { return false; }
      }, undefined, { timeout: 70_000 });
      await browser.page.locator('#activation-error-summary').getByRole('button', { name: 'Vérifier l’état' }).click();
    }
    await expect(agencyName).toHaveText('Espace conservé après reconnexion', { timeout: 30_000 });
    expect(probe.requests.slice(postReauthenticationProbeStart).some(request => request.method === 'GET' && request.route === '/v1/agencies/[agency]/activation' && request.status === 200)).toBe(true);
    await expect(browser.page.locator('.status-panel')).toBeVisible();
    expect(businessPosts.filter(path => path === '/v1/onboarding/invitation/claim')).toHaveLength(1);
    expect(businessPosts.filter(path => path === '/v1/agencies')).toHaveLength(1);
    expect(businessPosts.filter(path => /\/activation$|\/provisioning\/retry$/.test(path))).toEqual([]);
  } finally { await browser.context.close(); }
});

test('T08 creation is a human action; the returned agency state stays read-only', async () => {
  test.setTimeout(300_000);
  const invitation = await nativePendingInvitation(); const browser = await nativePage();
  const mutations: string[] = []; const fluxRequests: Array<{ path: string; method: string; at: number }> = []; const fluxResponses: Array<{ path: string; status: number }> = [];
  let retryAfterSeconds = 60; const retryAfterReads: Promise<void>[] = [];
  const startedAt = Date.now();
  try {
    browser.page.on('request', request => {
      const path = new URL(request.url()).pathname;
      if (/^\/v1\/(?:onboarding\/agency|onboarding\/invitation\/claim|agencies(?:\/|$))/.test(path)) fluxRequests.push({ path, method: request.method(), at: Date.now() });
    });
    browser.page.on('response', response => {
      const path = new URL(response.url()).pathname;
      if (/^\/v1\/(?:onboarding\/agency|onboarding\/invitation\/claim|agencies(?:\/|$))/.test(path)) fluxResponses.push({ path, status: response.status() });
      if (response.status() === 429 && /^\/v1\/(?:onboarding\/agency|onboarding\/invitation\/claim|agencies(?:\/|$))/.test(path)) retryAfterReads.push(response.headerValue('retry-after').then(value => { const seconds = Number(value); retryAfterSeconds = Number.isInteger(seconds) && seconds > 0 && seconds <= 600 ? Math.max(retryAfterSeconds, seconds) : Math.max(retryAfterSeconds, 60); }));
    });
    await enrollNative(browser.page, invitation, () => {});
    const probe = observeSafeFlow(browser.page);
    await browser.page.getByRole('heading', { name: 'Préparer votre espace' }).waitFor();
    await expect(browser.page.getByRole('heading', { name: 'Préparer votre espace' })).toBeFocused();
    await expect(browser.page.getByRole('button', { name: 'Continuer avec mon invitation' })).toBeVisible();
    await browser.page.keyboard.press('Shift+Tab');
    await expect(browser.page.locator(':focus')).toHaveAttribute('href', '/app/onboarding');
    await browser.page.keyboard.press('Shift+Tab');
    await expect(browser.page.locator(':focus')).toHaveAttribute('href', '#main');
    await browser.page.keyboard.press('Tab');
    await expect(browser.page.locator(':focus')).toHaveAttribute('href', '/app/onboarding');
    browser.page.on('request', request => {
      if (request.method() === 'POST' && /\/v1\/(?:agencies|onboarding\/invitation\/claim|agencies\/[^/]+\/activation|agencies\/[^/]+\/provisioning\/retry)$/.test(new URL(request.url()).pathname)) mutations.push(new URL(request.url()).pathname);
    });
    await browser.page.reload();
    const continueButton = browser.page.getByRole('button', { name: 'Continuer avec mon invitation' });
    const verifyAgainButton = browser.page.getByRole('button', { name: 'Vérifier à nouveau' });
    const settled = await browser.page.waitForFunction(() => {
      const visibleButtonNames = Array.from(document.querySelectorAll('button'))
        .filter(button => button.getClientRects().length > 0)
        .map(button => button.textContent?.trim());
      return visibleButtonNames.includes('Continuer avec mon invitation') || visibleButtonNames.includes('Vérifier à nouveau');
    }, undefined, { timeout: 30_000 }).then(() => true).catch(() => false);
    if (!settled) throw new Error('SAFE_ONBOARDING_RELOAD_DID_NOT_SETTLE ' + JSON.stringify(await safeFlowSnapshot(browser.page, probe)));
    if (!(await continueButton.isVisible().catch(() => false))) {
      await expect(verifyAgainButton).toBeVisible();
      await Promise.all(retryAfterReads);
      await browser.page.waitForTimeout((retryAfterSeconds + 1) * 1000);
      await verifyAgainButton.click();
      await expect(continueButton).toBeVisible({ timeout: 10_000 });
    }
    expect(mutations).toEqual([]);
    await browser.page.getByRole('button', { name: 'Continuer avec mon invitation' }).click();
    await browser.page.getByLabel('Nom de l’espace').waitFor();
    await browser.page.getByRole('button', { name: 'Créer mon espace' }).click();
    await expect(browser.page.locator('#form-error-summary')).toBeFocused();
    await browser.page.getByRole('link', { name: 'Aller à l’action suivante' }).click();
    await expect(browser.page.getByLabel('Nom de l’espace')).toBeFocused();
    expect(await declareCreateIntent(invitation)).toMatchObject({ t05: expect.any(Number), t06: expect.any(Number) });
    await browser.page.setViewportSize({ width: 320, height: 760 });
    expect(await browser.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await browser.page.getByLabel('Nom de l’espace').fill('Espace de démonstration');
    const created = browser.page.waitForResponse(response => new URL(response.url()).pathname === '/v1/agencies' && response.request().method() === 'POST');
    await browser.page.getByRole('button', { name: 'Créer mon espace' }).click();
    const response = await created; expect(response.status()).toBe(202);
    expect(await captureCreatedAgency()).toMatchObject({ t05: expect.any(Number), t06: expect.any(Number) });
    await expect(browser.page).toHaveURL(new RegExp('/app/agencies/[0-9a-f-]+/activation$'));
    await expect(browser.page.getByRole('heading', { name: 'Suivre la préparation' })).toBeVisible();
    await expect(browser.page.getByRole('heading', { name: 'Suivre la préparation' })).toBeFocused();
    await expect(browser.page.locator('.status-panel')).toBeVisible({ timeout: 30_000 });
    await expect(browser.page.locator('.status-mark')).toHaveClass(/status-provisioning/);
    await browser.context.setOffline(true);
    await expect(browser.page.getByText('Hors ligne. Le dernier état vérifié peut ne plus être actuel.')).toBeVisible();
    const resumedRead = browser.page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/activation') && response.request().method() === 'GET', { timeout: 90_000 });
    await browser.context.setOffline(false);
    await resumedRead;
    await expect(browser.page.getByText('Hors ligne. Le dernier état vérifié peut ne plus être actuel.')).toHaveCount(0);
    const rollingMaximum = Math.max(0, ...fluxRequests.map(({ at }) => fluxRequests.filter(item => item.at > at - 60_000 && item.at <= at).length));
    const pollRequests = fluxRequests.filter(item => item.path.endsWith('/activation') && item.method === 'GET');
    const pollRollingMaximum = Math.max(0, ...pollRequests.map(({ at }) => pollRequests.filter(item => item.at > at - 60_000 && item.at <= at).length));
    expect(rollingMaximum, JSON.stringify(fluxRequests.map(({ path, method, at }) => ({ path, method, elapsedMs: at - startedAt })))).toBeLessThanOrEqual(6);
    expect(pollRollingMaximum).toBeLessThanOrEqual(3);
    expect(fluxResponses.some(response => response.status === 429)).toBe(false);
    expect(mutations.filter(path => /\/activation$|\/provisioning\/retry$/.test(path))).toEqual([]);
    await browser.page.reload();
    await expect(browser.page.getByRole('heading', { name: 'Suivre la préparation' })).toBeVisible();
    await expect(browser.page.getByRole('button', { name: 'Vérifier l’état' })).toBeVisible();
    if (await browser.page.getByRole('alert').count()) {
      await expect(browser.page.getByRole('alert')).toBeFocused();
      await expect(browser.page.getByRole('alert').getByRole('link', { name: 'Aller à la vérification' })).toHaveAttribute('href', '#verify-state');
    }
    expect(mutations.filter(path => /\/activation$|\/provisioning\/retry$/.test(path))).toEqual([]);
  } finally { await browser.context.close(); }
});

test('T08 réconcilie une réponse de création perdue par lecture sans POST automatique', async () => {
  const invitation = await nativePendingInvitation(); const browser = await nativePage(); let createPosts = 0;
  try {
    await enrollNative(browser.page, invitation, () => {});
    await browser.page.getByRole('button', { name: 'Continuer avec mon invitation' }).click();
    await browser.page.getByLabel('Nom de l’espace').waitFor();
    await declareCreateIntent(invitation);
    await browser.page.evaluate(() => {
      const original = window.fetch.bind(window);
      (window as Window & { __createResponseDropped?: boolean }).__createResponseDropped = false;
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' || input instanceof URL ? input.toString() : input.url, location.href);
        const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
        const response = await original(input, init);
        const state = window as Window & { __createResponseDropped?: boolean };
        if (method === 'POST' && url.pathname === '/v1/agencies' && !state.__createResponseDropped) {
          state.__createResponseDropped = true;
          throw new TypeError('Failed to fetch');
        }
        return response;
      };
    });
    browser.page.on('request', request => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/v1/agencies') createPosts++;
    });
    await browser.page.getByLabel('Nom de l’espace').fill('Espace réponse perdue');
    const acceptedResponse = browser.page.waitForResponse(response => new URL(response.url()).pathname === '/v1/agencies' && response.request().method() === 'POST');
    await browser.page.getByRole('button', { name: 'Créer mon espace' }).click();
    const accepted = await acceptedResponse; expect(accepted.status()).toBe(202);
    expect(await captureCreatedAgency()).toMatchObject({ t05: expect.any(Number), t06: expect.any(Number) });
    await expect(browser.page.getByRole('button', { name: 'Vérifier l’état avant de continuer' })).toBeVisible();
    expect(createPosts).toBe(1);
    await browser.page.getByRole('button', { name: 'Vérifier l’état avant de continuer' }).click();
    await expect(browser.page).toHaveURL(/\/app\/agencies\/[0-9a-f-]+\/activation$/);
    expect(createPosts).toBe(1);
  } finally { await browser.context.close(); }
});

test('T08 conserve les noms Unicode valides et refuse plus de 120 points avant tout POST', async () => {
  test.setTimeout(600_000);
  const cases = [
    { value: '🏠'.repeat(120), canonical: '🏠'.repeat(120) },
    { value: 'e\u0301'.repeat(120), canonical: 'é'.repeat(120) },
  ];
  for (const item of cases) {
    const invitation = await nativePendingInvitation(); const browser = await nativePage(); const createBodies: Array<{ canonical: boolean; codePoints: number }> = [];
    try {
      browser.page.on('request', request => {
        if (request.method() !== 'POST' || new URL(request.url()).pathname !== '/v1/agencies') return;
        const body = request.postDataJSON() as { name?: unknown };
        if (typeof body.name === 'string') createBodies.push({ canonical: body.name === item.canonical, codePoints: Array.from(body.name).length });
      });
      await enrollNative(browser.page, invitation, () => {});
      await browser.page.getByRole('button', { name: 'Continuer avec mon invitation' }).click();
      const nameInput = browser.page.getByLabel('Nom de l’espace'); await nameInput.waitFor();
      await nameInput.fill('x'.repeat(121));
      const oversized = await nameInput.evaluate(input => Array.from((input as HTMLInputElement).value).length);
      await browser.page.getByRole('button', { name: 'Créer mon espace' }).click();
      await expect(browser.page.getByText('Saisissez un nom de 1 à 120 caractères.')).toBeVisible();
      expect(oversized).toBe(121); expect(createBodies).toEqual([]);

      await nameInput.fill(item.value);
      const typed = await nameInput.evaluate((input, expectedName) => ({ codePoints: Array.from((input as HTMLInputElement).value).length, codeUnits: (input as HTMLInputElement).value.length, preserved: (input as HTMLInputElement).value === expectedName }), item.value);
      expect(typed).toEqual({ codePoints: Array.from(item.value).length, codeUnits: item.value.length, preserved: true });
      await declareCreateIntent(invitation);
      const acceptedResponse = browser.page.waitForResponse(response => new URL(response.url()).pathname === '/v1/agencies' && response.request().method() === 'POST');
      await browser.page.getByRole('button', { name: 'Créer mon espace' }).click();
      const accepted = await acceptedResponse; expect(accepted.status()).toBe(202);
      expect(createBodies).toEqual([{ canonical: true, codePoints: 120 }]);
      expect(await captureCreatedAgency()).toMatchObject({ t05: expect.any(Number), t06: expect.any(Number) });
      await expect(browser.page.locator('.agency-name')).toBeVisible();
      const rendered = await browser.page.locator('.agency-name').evaluate((node, expectedName) => {
        const value = node.textContent ?? '';
        return { canonical: value === value.normalize('NFC'), codePoints: Array.from(value).length, expected: value === expectedName };
      }, item.canonical);
      expect(rendered).toEqual({ canonical: true, codePoints: 120, expected: true });
    } finally { await browser.context.close(); }
  }
});

test('T08 mobile view has labeled controls and uses same-origin built assets under TLS', async () => {
  const invitation = await nativePendingInvitation(); const browser = await nativePage();
  try {
    await enrollNative(browser.page, invitation, () => {});
    await expect(browser.page.getByRole('heading', { name: 'Préparer votre espace' })).toBeVisible();
    expect(new URL(browser.page.url()).origin).toBe('https://localhost:' + e.tlsPort);
    const assetResults = await browser.page.evaluate(async () => {
      const urls = [...document.querySelectorAll('script[src],link[rel="stylesheet"][href]')].map(node => node instanceof HTMLScriptElement ? node.src : (node as HTMLLinkElement).href);
      return Promise.all(urls.map(async url => { const response = await fetch(url, { cache: 'no-store' }); return { origin: new URL(url).origin, status: response.status, csp: response.headers.get('Content-Security-Policy') }; }));
    });
    expect(assetResults.length).toBeGreaterThan(1);
    expect(assetResults.every(asset => asset.origin === new URL(origin).origin && asset.status === 200 && asset.csp?.includes("script-src 'self'"))).toBe(true);
    await browser.page.setViewportSize({ width: 320, height: 740 });
    expect(await browser.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await browser.page.locator('.brand a').evaluate(node => (node as HTMLElement).getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await browser.page.keyboard.press('Tab'); await expect(browser.page.locator(':focus')).toBeVisible();
    await expect(browser.page.getByRole('button', { name: 'Continuer avec mon invitation' })).toHaveAttribute('type', 'button');
  } finally { await browser.context.close(); }
});

test('T08 relit READY puis ACTIVE après une confirmation API humaine explicite', async () => {
  test.setTimeout(600_000);
  const invitation = await nativePendingInvitation(); const browser = await nativePage(); const mutations: string[] = [];
  const probe = observeSafeFlow(browser.page);
  try {
    await enrollNative(browser.page, invitation, () => {});
    browser.page.on('request', request => {
      if (request.method() === 'POST' && /^\/v1\/(?:agencies(?:\/|$)|onboarding\/invitation\/claim)/.test(new URL(request.url()).pathname)) mutations.push(new URL(request.url()).pathname);
    });
    await browser.page.getByRole('button', { name: 'Continuer avec mon invitation' }).click();
    await browser.page.getByLabel('Nom de l’espace').waitFor();
    await declareCreateIntent(invitation, 't07');
    await browser.page.getByLabel('Nom de l’espace').fill('Espace de lecture ACTIVE');
    const acceptedResponse = browser.page.waitForResponse(response => new URL(response.url()).pathname === '/v1/agencies' && response.request().method() === 'POST');
    await browser.page.getByRole('button', { name: 'Créer mon espace' }).click();
    const accepted = await acceptedResponse; expect(accepted.status()).toBe(202);
    const created = await accepted.json() as { agencyId: string };
    expect(await captureCreatedAgency()).toMatchObject({ t05: expect.any(Number), t07: expect.any(Number) });
    await expect(browser.page.getByRole('heading', { name: 'Suivre la préparation' })).toBeVisible();
    await expect(browser.page.getByRole('heading', { name: 'Votre espace est prêt' })).toBeVisible({ timeout: 240_000 });
    await expect(browser.page.getByRole('status').filter({ hasText: 'Votre espace est prêt' })).toBeVisible();
    await expect(browser.page.getByText('L’activation n’est pas disponible actuellement.')).toBeVisible();
    expect(mutations.filter(path => /\/activation$|\/provisioning\/retry$/.test(path))).toEqual([]);

    const version = await browser.page.evaluate(async id => {
      const response = await fetch(`/v1/agencies/${id}/activation`, { credentials: 'same-origin', cache: 'no-store' });
      return (await response.json() as { version: string }).version;
    }, created.agencyId);
    const command = await browser.page.evaluate(async input => {
      const session = await fetch('/v1/session', { credentials: 'same-origin', cache: 'no-store' }).then(response => response.json()) as { csrfToken?: string };
      const response = await fetch(`/v1/agencies/${input.id}/activation`, { method: 'POST', credentials: 'same-origin', headers: {
        'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken ?? '', 'Idempotency-Key': input.key, 'If-Match': `"${input.version}"`,
      }, body: '{}' });
      return { status: response.status, state: (await response.json() as { state: string }).state };
    }, { id: created.agencyId, key: randomUUID(), version });
    expect(command).toEqual({ status: 200, state: 'ACTIVE' });
    const afterConfirmationReload = probe.requests.length;
    await browser.page.reload();
    const activeHeading = browser.page.getByRole('heading', { name: 'Votre espace est activé' });
    const verifyState = browser.page.locator('#activation-error-summary').getByRole('button', { name: 'Vérifier l’état' });
    await browser.page.waitForFunction(() => {
      const heading = document.querySelector('#activation-heading')?.textContent?.trim();
      const verify = [...document.querySelectorAll('#activation-error-summary button')].some(button => button.textContent?.trim() === 'Vérifier l’état');
      return heading === 'Votre espace est activé' || verify;
    }, undefined, { timeout: 90_000 });
    if (!(await activeHeading.isVisible().catch(() => false))) {
      const blocked = await safeFlowSnapshot(browser.page, probe);
      expect(blocked.route).toBe('/app/agencies/[agency]/activation');
      expect(blocked.error).toBe('LOCAL_QUOTA');
      expect(blocked.quota?.calls).toBe(6);
      expect(blocked.quota?.oldestAgeMs).toBeLessThan(60_000);
      expect(blocked.sessions.some(session => session.scope === 'agency' && session.agencyIdPresent
        && session.requestIndex >= afterConfirmationReload
        && probe.requests[session.requestIndex]?.route === '/v1/session'
        && probe.requests[session.requestIndex]?.method === 'GET'
        && probe.requests[session.requestIndex]?.status === 200)).toBe(true);
      const afterReload = () => probe.requests.slice(afterConfirmationReload);
      expect(afterReload().some(request => request.method === 'GET' && request.route === '/v1/agencies/[agency]/activation')).toBe(false);
      expect(afterReload().some(request => request.status === 429)).toBe(false);
      await expect(verifyState).toBeVisible();
      await browser.page.waitForFunction(() => {
        try {
          const quota = JSON.parse(sessionStorage.getItem('dossiercle:t05-client-quota:v1') ?? 'null') as { calls?: unknown } | null;
          const cooldown = JSON.parse(sessionStorage.getItem('dossiercle:bootstrap-cooldown:v1') ?? 'null') as { blockedUntil?: unknown } | null;
          return Array.isArray(quota?.calls)
            && quota.calls.filter(at => typeof at === 'number' && Date.now() - at < 60_000).length <= 5
            && typeof cooldown?.blockedUntil === 'number' && cooldown.blockedUntil <= Date.now();
        } catch { return false; }
      }, undefined, { timeout: 90_000 });
      await verifyState.click();
    }
    await expectVisibleAfterSafeSettle(browser.page, activeHeading, probe);
    expect(probe.requests.slice(afterConfirmationReload).some(request => request.method === 'GET' && request.route === '/v1/agencies/[agency]/activation' && request.status === 200)).toBe(true);
    await expect(browser.page.getByRole('status').filter({ hasText: 'Votre espace est activé' })).toBeVisible();
    expect(mutations.filter(path => /\/activation$|\/provisioning\/retry$/.test(path))).toEqual([`/v1/agencies/${created.agencyId}/activation`]);
    await expect(browser.page.getByText('Aucune fonction IA ni connexion e-mail n’est activée.').first()).toBeVisible();
  } finally { await browser.context.close(); }
});

test('T08 projette FAILED après lecture native sans déclencher de reprise', async () => {
  test.setTimeout(600_000);
  const invitation = await nativePendingInvitation(); const browser = await nativePage(); const mutations: string[] = [];
  const probe = observeSafeFlow(browser.page);
  try {
    await enrollNative(browser.page, invitation, () => {});
    await browser.page.getByRole('button', { name: 'Continuer avec mon invitation' }).click();
    await browser.page.getByLabel('Nom de l’espace').waitFor();
    await declareCreateIntent(invitation, 't07');
    await browser.page.getByLabel('Nom de l’espace').fill('Espace de lecture FAILED');
    const acceptedResponse = browser.page.waitForResponse(response => new URL(response.url()).pathname === '/v1/agencies' && response.request().method() === 'POST');
    await browser.page.getByRole('button', { name: 'Créer mon espace' }).click();
    const accepted = await acceptedResponse; expect(accepted.status()).toBe(202);
    const created = await accepted.json() as { agencyId: string; operationId: string };
    expect(await captureCreatedAgency()).toMatchObject({ t05: expect.any(Number), t07: expect.any(Number) });
    await expect(browser.page.getByRole('heading', { name: 'Votre espace est prêt' })).toBeVisible({ timeout: 240_000 });
    expect(await markAgencyFailedFixture(created.agencyId, created.operationId)).toMatchObject({ t05: expect.any(Number), t07: expect.any(Number) });
    browser.page.on('request', request => {
      if (request.method() === 'POST' && /\/v1\/agencies\//.test(new URL(request.url()).pathname)) mutations.push(new URL(request.url()).pathname);
    });
    const afterReloadStart = probe.requests.length;
    await browser.page.reload();
    const failedHeading = browser.page.getByRole('heading', { name: 'Préparation à vérifier' });
    const verifyState = browser.page.locator('#activation-error-summary').getByRole('button', { name: 'Vérifier l’état' });
    await browser.page.waitForFunction(() => {
      const heading = document.querySelector('#activation-heading')?.textContent?.trim();
      const verify = [...document.querySelectorAll('#activation-error-summary button')].some(button => button.textContent?.trim() === 'Vérifier l’état');
      return heading === 'Préparation à vérifier' || verify;
    }, undefined, { timeout: 90_000 });
    if (!(await failedHeading.isVisible().catch(() => false))) {
      const blocked = await safeFlowSnapshot(browser.page, probe);
      expect(blocked.route).toBe('/app/agencies/[agency]/activation');
      expect(blocked.heading).toBe('Suivre la préparation');
      expect(blocked.error).toBe('LOCAL_QUOTA');
      await expect(browser.page.getByRole('alert')).toContainText('Trop de vérifications ont été effectuées. Attendez avant de vérifier à nouveau.');
      expect(blocked.quota?.calls).toBe(6);
      expect(blocked.quota?.oldestAgeMs).not.toBeNull();
      expect(blocked.quota!.oldestAgeMs!).toBeLessThan(60_000);
      expect(blocked.sessions.some(session => session.scope === 'onboarding' && !session.agencyIdPresent
        && session.requestIndex >= afterReloadStart
        && probe.requests[session.requestIndex]?.route === '/v1/session'
        && probe.requests[session.requestIndex]?.method === 'GET'
        && probe.requests[session.requestIndex]?.status === 200)).toBe(true);
      const afterReload = () => probe.requests.slice(afterReloadStart);
      const discoveryReads = afterReload().filter(request => request.method === 'GET' && request.route === '/v1/onboarding/agency');
      expect(discoveryReads.length).toBeLessThanOrEqual(1);
      if (discoveryReads.length === 1) expect(discoveryReads[0]?.status).toBe(200);
      expect(afterReload().some(request => request.method === 'GET' && request.route === '/v1/agencies/[agency]/activation')).toBe(false);
      expect(afterReload().some(request => request.status === 429)).toBe(false);
      await expect(verifyState).toBeVisible();
      await browser.page.waitForFunction(() => {
        try {
          const quota = JSON.parse(sessionStorage.getItem('dossiercle:t05-client-quota:v1') ?? 'null') as { calls?: unknown } | null;
          const cooldown = JSON.parse(sessionStorage.getItem('dossiercle:bootstrap-cooldown:v1') ?? 'null') as { blockedUntil?: unknown } | null;
          return Array.isArray(quota?.calls)
            && quota.calls.filter(at => typeof at === 'number' && Date.now() - at < 60_000).length <= 4
            && typeof cooldown?.blockedUntil === 'number' && cooldown.blockedUntil <= Date.now();
        } catch { return false; }
      }, undefined, { timeout: 120_000 });
      const afterManualVerifyStart = probe.requests.length;
      await verifyState.click();
      await expectVisibleAfterSafeSettle(browser.page, failedHeading, probe);
      const afterManualVerify = probe.requests.slice(afterManualVerifyStart);
      expect(afterManualVerify.some(request => request.method === 'GET' && request.route === '/v1/onboarding/agency' && request.status === 200)).toBe(true);
      expect(afterManualVerify.some(request => request.method === 'GET' && request.route === '/v1/agencies/[agency]/activation' && request.status === 200)).toBe(true);
    }
    await expectVisibleAfterSafeSettle(browser.page, failedHeading, probe);
    expect(probe.requests.slice(afterReloadStart).some(request => request.method === 'GET' && request.route === '/v1/onboarding/agency' && request.status === 200)).toBe(true);
    expect(probe.requests.slice(afterReloadStart).some(request => request.method === 'GET' && request.route === '/v1/agencies/[agency]/activation' && request.status === 200)).toBe(true);
    await expect(browser.page.getByRole('status').filter({ hasText: 'Préparation à vérifier' })).toBeVisible();
    await expect(browser.page.getByRole('button', { name: 'Vérifier l’état' })).toBeVisible();
    await expect(browser.page.getByRole('button', { name: /reprendre|réessayer|relancer/i })).toHaveCount(0);
    expect(mutations).toEqual([]);
  } finally { await browser.context.close(); }
});

test('T08 refuse une seconde agence réellement créée sous une autre session native', async () => {
  test.setTimeout(180_000);
  const firstInvitation = await nativePendingInvitation(); const first = await nativePage();
  const secondInvitation = await nativePendingInvitation(); const second = await nativePage();
  const firstProbe = observeSafeFlow(first.page);
  try {
    await enrollNative(first.page, firstInvitation, () => {});
    await first.page.getByRole('button', { name: 'Continuer avec mon invitation' }).click();
    await first.page.getByLabel('Nom de l’espace').waitFor();
    await declareCreateIntent(firstInvitation);
    await first.page.getByLabel('Nom de l’espace').fill('Agence native première');
    const firstAccepted = first.page.waitForResponse(response => new URL(response.url()).pathname === '/v1/agencies' && response.request().method() === 'POST');
    await first.page.getByRole('button', { name: 'Créer mon espace' }).click();
    expect((await firstAccepted).status()).toBe(202);
    expect(await captureCreatedAgency()).toMatchObject({ t05: expect.any(Number), t06: expect.any(Number) });
    const firstBody = await first.page.waitForURL(/\/app\/agencies\/[0-9a-f-]+\/activation$/).then(() => first.page.url());
    const firstId = firstBody.match(/agencies\/([0-9a-f-]+)\/activation$/)?.[1];
    expect(firstId).toBeTruthy();

    await enrollNative(second.page, secondInvitation, () => {});
    await second.page.getByRole('button', { name: 'Continuer avec mon invitation' }).click();
    await second.page.getByLabel('Nom de l’espace').waitFor();
    await declareCreateIntent(secondInvitation);
    await second.page.getByLabel('Nom de l’espace').fill('Agence native seconde');
    const secondAccepted = second.page.waitForResponse(response => new URL(response.url()).pathname === '/v1/agencies' && response.request().method() === 'POST');
    await second.page.getByRole('button', { name: 'Créer mon espace' }).click();
    expect((await secondAccepted).status()).toBe(202);
    expect(await captureCreatedAgency()).toMatchObject({ t05: expect.any(Number), t06: expect.any(Number) });
    await second.page.waitForURL(/\/app\/agencies\/[0-9a-f-]+\/activation$/);
    const secondId = second.page.url().match(/agencies\/([0-9a-f-]+)\/activation$/)?.[1];
    expect(secondId).toBeTruthy(); expect(secondId).not.toBe(firstId);

    await first.page.goto(origin + '/app/agencies/' + secondId + '/activation');
    await expect(first.page.getByText('Cet espace n’est pas disponible pour cette session.'), JSON.stringify(await safeFlowSnapshot(first.page, firstProbe))).toBeVisible();
    expect(await first.page.locator('body').innerText()).not.toContain('Agence native seconde');
  } finally { await first.context.close(); await second.context.close(); }
});

test('lecteur Orca réel après MFA sur l’application annonce le titre, le statut et les actions', async () => {
  test.setTimeout(300_000);
  const invitation = await nativePendingInvitation(); const browser = await nativePage({ headless: false, zoom200: true });
  let reader: ReturnType<typeof spawn> | undefined;
  const debugPath = e.root + '/.local/accessibility/orca-debug-pr2-final.log';
  try {
    await enrollNative(browser.page, invitation, () => {});
    await browser.page.getByRole('button', { name: 'Continuer avec mon invitation' }).click();
    await browser.page.getByLabel('Nom de l’espace').waitFor();
    await declareCreateIntent(invitation, 't07');
    await browser.page.getByLabel('Nom de l’espace').fill('Espace lecteur écran');
    const acceptedResponse = browser.page.waitForResponse(response => new URL(response.url()).pathname === '/v1/agencies' && response.request().method() === 'POST');
    await browser.page.getByRole('button', { name: 'Créer mon espace' }).click();
    const accepted = await acceptedResponse; expect(accepted.status()).toBe(202);
    expect(await captureCreatedAgency()).toMatchObject({ t05: expect.any(Number), t07: expect.any(Number) });
    await expect(browser.page.getByRole('heading', { name: 'Suivre la préparation' })).toBeVisible();
    reader = spawn('/usr/bin/python3', [e.root + '/.local/accessibility/root/usr/bin/orca', '--replace', '--debug-file', debugPath], {
      stdio: 'ignore', env: {
        ...process.env,
        HOME: e.root + '/.local/accessibility/home',
        XDG_CONFIG_HOME: e.root + '/.local/accessibility/home/.config',
        XDG_CACHE_HOME: e.root + '/.local/accessibility/home/.cache',
        PYTHONPATH: e.root + '/.local/accessibility/root/usr/lib/python3/dist-packages',
        XDG_DATA_DIRS: e.root + '/.local/accessibility/root/usr/share:/usr/local/share:/usr/share',
      },
    });
    let exit: { code: number | null; signal: NodeJS.Signals | null } | undefined;
    reader.once('exit', (code, signal) => { exit = { code, signal }; });
    await new Promise(resolve => setTimeout(resolve, 2500));
    expect(exit, 'Orca doit rester actif après initialisation').toBeUndefined();
    expect(reader.pid).toBeGreaterThan(0);

    const script = [
      'import time, pyatspi',
      'desktop=pyatspi.Registry.getDesktop(0)',
      "found={'heading':False,'button':False}",
      'def walk(node,depth=0):',
      ' if depth>45:return',
      ' try:',
      "  role=node.getRoleName().lower(); name=node.name or ''",
      "  if role=='heading' and name=='Suivre la préparation':found['heading']=True",
      "  if role in ('push button','button') and name=='Vérifier l’état':found['button']=True",
      '  count=node.childCount',
      ' except Exception:return',
      ' for index in range(count):',
      '  try:walk(node.getChildAtIndex(index),depth+1)',
      '  except Exception:pass',
      'for attempt in range(24):',
      ' walk(desktop)',
      ' if all(found.values()):break',
      ' time.sleep(.5)',
      "print('heading=%s;button=%s'%('yes' if found['heading'] else 'no','yes' if found['button'] else 'no'))",
    ].join('\n');
    const { stdout } = await run('/usr/bin/python3', ['-c', script], {
      cwd: e.root,
      env: { ...process.env, PYTHONPATH: e.root + '/.local/accessibility/root/usr/lib/python3/dist-packages' }, timeout: 20_000,
    });
    expect(stdout.trim()).toBe('heading=yes;button=yes');

    await expect(browser.page.getByRole('heading', { name: 'Votre espace est prêt' })).toBeVisible({ timeout: 240_000 });
    await expect(browser.page.getByRole('heading', { name: 'Suivre la préparation' })).toBeFocused();
    const initialVisual = await browser.page.evaluate(() => ({ width: document.documentElement.clientWidth, dpr: window.devicePixelRatio }));
    const xdotool = e.root + '/.local/accessibility/xdotool-root/usr/bin/xdotool';
    const xdotoolEnv = { ...process.env, LD_LIBRARY_PATH: e.root + '/.local/accessibility/xdotool-root/usr/lib/x86_64-linux-gnu' };
    const windowId = (await run(xdotool, ['search', '--onlyvisible', '--class', 'firefox'], { env: xdotoolEnv })).stdout.trim().split('\n').at(-1);
    if (!windowId) throw new Error('ACCESSIBILITY_BROWSER_WINDOW_UNAVAILABLE');
    await run(xdotool, ['windowactivate', '--sync', windowId], { env: xdotoolEnv });
    await run(xdotool, ['key', '--clearmodifiers', 'ctrl+0'], { env: xdotoolEnv });
    for (let step = 0; step < 12; step += 1) {
      await run(xdotool, ['key', '--clearmodifiers', 'ctrl+plus'], { env: xdotoolEnv });
      await browser.page.waitForTimeout(120);
      const currentDpr = await browser.page.evaluate(() => window.devicePixelRatio);
      if (currentDpr / initialVisual.dpr >= 2) break;
    }
    let observedZoom = await browser.page.evaluate(dpr => window.devicePixelRatio / dpr, initialVisual.dpr);
    for (let step = 0; observedZoom > 2.05 && step < 4; step += 1) {
      await run(xdotool, ['key', '--clearmodifiers', 'ctrl+minus'], { env: xdotoolEnv });
      await browser.page.waitForTimeout(120);
      observedZoom = await browser.page.evaluate(dpr => window.devicePixelRatio / dpr, initialVisual.dpr);
    }
    await browser.page.keyboard.press('Tab');
    await expect(browser.page.getByRole('button', { name: 'Vérifier l’état' })).toBeFocused();
    const visual = await browser.page.evaluate(() => {
      const rgb = (value: string) => value.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
      const luminance = (color: string) => {
        const channels = rgb(color).map(channel => { const value = channel / 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; });
        return channels[0]! * .2126 + channels[1]! * .7152 + channels[2]! * .0722;
      };
      const ratio = (foreground: string, background: string) => { const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a); return Number(((values[0]! + .05) / (values[1]! + .05)).toFixed(2)); };
      const style = (selector: string) => getComputedStyle(document.querySelector(selector)!);
      const body = style('body'), card = style('.card'), button = style('#verify-state'), status = style('.status-panel');
      const pairs = { body: ratio(body.color, body.backgroundColor), heading: ratio(style('h1').color, card.backgroundColor), button: ratio(button.color, button.backgroundColor), status: ratio(style('.status-panel p').color, status.backgroundColor), focus: ratio(button.outlineColor, card.backgroundColor) };
      return { devicePixelRatio: window.devicePixelRatio, viewportWidth: document.documentElement.clientWidth, documentWidth: document.documentElement.scrollWidth, pairs, outlineWidth: button.outlineWidth };
    });
    expect(visual.devicePixelRatio / initialVisual.dpr).toBeGreaterThanOrEqual(1.95);
    expect(visual.devicePixelRatio / initialVisual.dpr).toBeLessThanOrEqual(2.05);
    expect(visual.documentWidth).toBeLessThanOrEqual(visual.viewportWidth);
    expect(visual.pairs.body).toBeGreaterThanOrEqual(4.5); expect(visual.pairs.heading).toBeGreaterThanOrEqual(4.5);
    expect(visual.pairs.button).toBeGreaterThanOrEqual(4.5); expect(visual.pairs.status).toBeGreaterThanOrEqual(4.5);
    expect(visual.pairs.focus).toBeGreaterThanOrEqual(3); expect(visual.outlineWidth).not.toBe('0px');
    await browser.page.emulateMedia({ reducedMotion: 'reduce' });
    const motion = await browser.page.evaluate(() => ({ scroll: getComputedStyle(document.documentElement).scrollBehavior, transition: getComputedStyle(document.querySelector('button')!).transitionDuration, animation: getComputedStyle(document.querySelector('button')!).animationDuration }));
    expect(motion.scroll).toBe('auto'); expect(Number.parseFloat(motion.transition)).toBeLessThanOrEqual(.0001); expect(Number.parseFloat(motion.animation)).toBeLessThanOrEqual(.0001);
    const proofDir = e.root + '/.agentic-local/docs/agentic/work/79-s01-t08-build/proofs'; await mkdir(proofDir, { recursive: true, mode: 0o700 });
    await browser.page.screenshot({ path: proofDir + '/pr2-orca-zoom200.png', fullPage: true });
    await writeFile(proofDir + '/pr2-rendered-a11y.json', JSON.stringify({ route: '/app/agencies/[agency]/activation', zoom: 200, visual, motion, reader: 'alive-after-native-mfa' }, null, 2) + '\n', { mode: 0o600 });
    await new Promise(resolve => setTimeout(resolve, 1500));
    expect(exit, 'Orca doit rester actif pendant les annonces').toBeUndefined();
    const utterances = await readFile(debugPath, 'utf8');
    const expectedUi = ['Suivre la préparation', 'Votre espace est prêt', 'Vérifier l’état'];
    for (const phrase of expectedUi) expect(utterances).toContain(phrase);
    expect(utterances).not.toMatch(/password|mot de passe|otp|recovery|secret|code de vérification/i);
  } finally {
    reader?.kill('SIGTERM'); await browser.context.close();
  }
});
