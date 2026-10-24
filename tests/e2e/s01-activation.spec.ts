import { expect, test, type Page } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { safeSyntheticResponse } from '../../packages/testing/src/s01-fixtures.js';
import { e, origin, nativePage, nativePendingInvitation, enrollNative } from '../auth/private-t05-native.js';
import { captureCreatedAgency, declareCreateIntent, expireNativeBffSession, markAgencyFailedFixture, verifyFailedFixtureStability, qualifyRetryableFailed, retryDurableEvidence, assertNoActiveReader, beginOwnedReaderCapture, confirmOwnedReaderExit } from './private-s01-fixture.js';

test.beforeEach(async () => { await assertNoActiveReader(); });

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

/** Observe the real client budget without clearing it or increasing its limits. */
async function waitForActionBudget(page: Page, reserved: number) {
  await page.waitForFunction(needed => {
    const quota = JSON.parse(sessionStorage.getItem('dossiercle:t05-client-quota:v1') ?? 'null') as { calls?: number[] } | null;
    const cooldown = JSON.parse(sessionStorage.getItem('dossiercle:bootstrap-cooldown:v1') ?? 'null') as { blockedUntil?: number } | null;
    return Array.isArray(quota?.calls) && quota.calls.filter(at => Date.now() - at < 60_000).length <= 6 - needed
      && (cooldown?.blockedUntil ?? 0) <= Date.now();
  }, reserved, { timeout: 75_000 });
}
async function createReadyForAction(page: Page, name: string) {
  const invitation = await nativePendingInvitation();
  await enrollNative(page, invitation, () => {});
  await page.getByRole('button', { name: 'Continuer avec mon invitation' }).click();
  await page.getByLabel('Nom de l’espace').waitFor();
  await declareCreateIntent(invitation, 't07');
  await page.getByLabel('Nom de l’espace').fill(name);
  const pending = page.waitForResponse(response => new URL(response.url()).pathname === '/v1/agencies' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  const accepted = await pending; expect(accepted.status()).toBe(202);
  const created = await accepted.json() as { agencyId: string; operationId: string };
  expect(await captureCreatedAgency()).toMatchObject({ t05: expect.any(Number), t07: expect.any(Number) });
  await expect(page.getByRole('heading', { name: 'Votre espace est prêt' })).toBeVisible({ timeout: 240_000 });
  await waitForActionBudget(page, 5);
  return created;
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

test('T08 active READY après confirmation humaine accessible puis relit ACTIVE', async () => {
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
    await expect(browser.page.getByRole('button', { name: 'Activer mon espace' })).toBeVisible();
    expect(mutations.filter(path => /\/activation$|\/provisioning\/retry$/.test(path))).toEqual([]);

    const activationButton = browser.page.getByRole('button', { name: 'Activer mon espace' });
    await waitForActionBudget(browser.page, 5);
    await activationButton.click();
    const confirmation = browser.page.getByRole('heading', { name: 'Confirmer l’activation' });
    await expect(confirmation).toBeFocused();
    await expect(browser.page.getByText(/Espace de lecture ACTIVE.*version/)).toBeVisible();
    await expect(browser.page.getByText('Cette action rendra l’espace actif. Aucune fonction IA ni connexion e-mail ne sera activée.')).toBeVisible();
    await browser.page.getByRole('button', { name: 'Revenir' }).click();
    await expect(activationButton).toBeFocused();
    await waitForActionBudget(browser.page, 3);
    await activationButton.click();
    const activationResponse = browser.page.waitForResponse(response => new URL(response.url()).pathname === `/v1/agencies/${created.agencyId}/activation` && response.request().method() === 'POST');
    await browser.page.getByRole('button', { name: 'Confirmer l’activation', exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
    const command = await activationResponse;
    const headers = command.request().headers();
    expect(/^[0-9a-f-]{36}$/i.test(headers['idempotency-key'] ?? '')).toBe(true);
    expect(/^"[1-9][0-9]*"$/.test(headers['if-match'] ?? '')).toBe(true);
    expect(/^[A-Za-z0-9_-]{43}$/.test(headers['x-csrf-token'] ?? '')).toBe(true);
    expect(command.request().postData() === '{}').toBe(true);
    expect(command.status()).toBe(200);
    expect((await command.json() as { state: string; agencyId: string })).toMatchObject({ state: 'ACTIVE', agencyId: created.agencyId });
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

test('T08 activation perdue après commit reste incertaine puis réconcilie ACTIVE sans nouvelle mutation', async () => {
  test.setTimeout(480_000);
  const browser = await nativePage(); let activationPosts = 0; let committed = false;
  try {
    const created = await createReadyForAction(browser.page, 'Espace activation incertaine');
    const path = `/v1/agencies/${created.agencyId}/activation`;
    await browser.page.route(origin + path, async route => {
      if (route.request().method() !== 'POST') return route.continue();
      activationPosts += 1;
      const response = await safeSyntheticResponse(() => route.fetch());
      expect(response.status()).toBe(200);
      const central = await response.json() as { state: string; agencyId: string };
      expect(central.state === 'ACTIVE' && central.agencyId === created.agencyId).toBe(true);
      committed = true;
      await route.abort('failed');
    });
    await browser.page.getByRole('button', { name: 'Activer mon espace' }).click();
    await expect(browser.page.getByRole('heading', { name: 'Confirmer l’activation' })).toBeFocused();
    await browser.page.getByRole('button', { name: 'Confirmer l’activation', exact: true }).click();
    await expect(browser.page.getByRole('alert')).toContainText('Le résultat de l’activation est incertain.');
    await expect(browser.page.getByRole('alert')).toBeFocused();
    expect(committed).toBe(true); expect(activationPosts).toBe(1);
    await browser.page.waitForTimeout(1500);
    await expect(browser.page.getByRole('alert')).toContainText('Vérifiez l’état avant toute nouvelle action.');
    await expect(browser.page.locator('#verify-state')).toHaveCount(1);
    expect(activationPosts).toBe(1);
    await waitForActionBudget(browser.page, 2);
    await browser.page.locator('#activation-error-summary').getByRole('button', { name: 'Vérifier l’état' }).click();
    await expect(browser.page.getByRole('heading', { name: 'Votre espace est activé' })).toBeVisible();
    expect(activationPosts).toBe(1);
    await browser.page.reload();
    await expect(browser.page.getByRole('heading', { name: 'Votre espace est activé' })).toBeVisible();
    expect(activationPosts).toBe(1);
  } finally { await browser.context.close(); }
});

test('T08 activation refuse version périmée et CSRF absent puis revalide la session avant confirmation', async () => {
  test.setTimeout(480_000);
  const browser = await nativePage(); let uiActivationPosts = 0;
  try {
    const created = await createReadyForAction(browser.page, 'Espace autorisation courante');
    const refusals = await browser.page.evaluate(async id => {
      const session = await fetch('/v1/session', { cache: 'no-store' }).then(response => response.json()) as { csrfToken: string };
      const path = `/v1/agencies/${id}/activation`;
      const current = await fetch(path, { cache: 'no-store' }).then(response => response.json()) as { state: string; version: string };
      const stale = (BigInt(current.version) - 1n).toString();
      const base = { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), 'If-Match': `"${stale}"` };
      const version = await fetch(path, { method: 'POST', headers: { ...base, 'X-CSRF-Token': session.csrfToken }, body: '{}' });
      const csrf = await fetch(path, { method: 'POST', headers: { ...base, 'Idempotency-Key': crypto.randomUUID(), 'If-Match': `"${current.version}"` }, body: '{}' });
      const wrongNonce = (session.csrfToken[0] === 'A' ? 'B' : 'A') + session.csrfToken.slice(1);
      const wrongCsrf = await fetch(path, { method: 'POST', headers: { ...base, 'Idempotency-Key': crypto.randomUUID(), 'If-Match': `"${current.version}"`, 'X-CSRF-Token': wrongNonce }, body: '{}' });
      const after = await fetch(path, { cache: 'no-store' }).then(response => response.json()) as { state: string; version: string };
      return { versionStatus: version.status, csrfStatus: csrf.status, wrongCsrfStatus: wrongCsrf.status, unchanged: after.state === 'READY' && after.version === current.version };
    }, created.agencyId);
    expect(refusals).toEqual({ versionStatus: 409, csrfStatus: 400, wrongCsrfStatus: 403, unchanged: true });
    // Direct negative requests also count on the server; wait a full real quota window.
    await browser.page.waitForTimeout(61_000);
    for (let index = 0; index < 6; index += 1) {
      await browser.page.getByRole('button', { name: 'Vérifier l’état', exact: true }).click();
      await expect(browser.page.locator('main')).toHaveAttribute('aria-busy', 'false');
    }
    await browser.page.getByRole('button', { name: 'Activer mon espace' }).click();
    await expect(browser.page.getByRole('alert')).toContainText('Trop de vérifications ont été effectuées.');
    await expect(browser.page.getByRole('alert')).toBeFocused();
    await expect(browser.page.locator('#verify-state')).toHaveCount(1);
    await expect(browser.page.getByRole('button', { name: 'Vérifier l’état', exact: true })).toHaveCount(1);
    await waitForActionBudget(browser.page, 3);
    await browser.page.getByRole('button', { name: 'Activer mon espace' }).click();
    await expect(browser.page.getByRole('heading', { name: 'Confirmer l’activation' })).toBeFocused();
    const cookie = (await browser.context.cookies(origin)).find(value => value.name === '__Host-dossiercle');
    if (!cookie) throw new Error('NATIVE_BFF_COOKIE_ABSENT');
    await expireNativeBffSession(cookie.value);
    browser.page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === `/v1/agencies/${created.agencyId}/activation`) uiActivationPosts += 1; });
    await browser.page.getByRole('button', { name: 'Confirmer l’activation', exact: true }).click();
    await expect(browser.page.getByRole('alert')).toContainText('Cet espace n’est pas disponible pour cette session.');
    await expect(browser.page.getByRole('alert')).toBeFocused();
    await expect(browser.page.locator('.agency-name')).toHaveCount(0);
    await expect(browser.page.getByRole('heading', { name: 'Confirmer l’activation' })).toHaveCount(0);
    expect(uiActivationPosts).toBe(0);
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
    await verifyFailedFixtureStability(created.agencyId, created.operationId);
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
    await expect(browser.page.getByText('La préparation nécessite une vérification. La reprise n’est pas disponible actuellement. Contactez le propriétaire de votre organisation.')).toBeVisible();
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

    const foreignActivation = await first.page.evaluate(async id => {
      const session = await fetch('/v1/session', { cache: 'no-store' }).then(response => response.json()) as { csrfToken: string };
      const response = await fetch(`/v1/agencies/${id}/activation`, { method: 'POST', headers: {
        'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken,
        'Idempotency-Key': crypto.randomUUID(), 'If-Match': '"1"',
      }, body: '{}' });
      const body = await response.json() as { code?: unknown; agencyId?: unknown; name?: unknown };
      return { status: response.status, noObject: body.agencyId === undefined && body.name === undefined };
    }, secondId!);
    expect([403, 404]).toContain(foreignActivation.status); expect(foreignActivation.noObject).toBe(true);
    await first.page.goto(origin + '/app/agencies/' + secondId + '/activation');
    await expect(first.page.getByText('Cet espace n’est pas disponible pour cette session.'), JSON.stringify(await safeFlowSnapshot(first.page, firstProbe))).toBeVisible();
    expect(await first.page.locator('body').innerText()).not.toContain('Agence native seconde');
  } finally { await first.context.close(); await second.context.close(); }
});

test('lecteur Orca réel après MFA sur l’application annonce le titre, le statut et les actions', async () => {
  test.setTimeout(600_000);
  const invitation = await nativePendingInvitation(); const browser = await nativePage({ headless: false, zoom200: true });
  const longAgencyName = 'W'.repeat(120);
  let reader: ReturnType<typeof spawn> | undefined;
  let readerCapture: string | undefined;
  const debugPath = e.root + '/.local/accessibility/orca-debug-pr2-final.log';
  try {
    await enrollNative(browser.page, invitation, () => {});
    await browser.page.getByRole('button', { name: 'Continuer avec mon invitation' }).click();
    await browser.page.getByLabel('Nom de l’espace').waitFor();
    await declareCreateIntent(invitation, 't07');
    await browser.page.getByLabel('Nom de l’espace').fill(longAgencyName);
    const acceptedResponse = browser.page.waitForResponse(response => new URL(response.url()).pathname === '/v1/agencies' && response.request().method() === 'POST');
    await browser.page.getByRole('button', { name: 'Créer mon espace' }).click();
    const accepted = await acceptedResponse; expect(accepted.status()).toBe(202);
    expect(await captureCreatedAgency()).toMatchObject({ t05: expect.any(Number), t07: expect.any(Number) });
    await expect(browser.page.getByRole('heading', { name: 'Suivre la préparation' })).toBeVisible();
    readerCapture = await beginOwnedReaderCapture();
    reader = spawn('/usr/bin/python3', ['/usr/bin/orca', '--replace', '--debug-file', debugPath], {
      stdio: 'ignore', env: {
        ...process.env,
        XDG_CONFIG_HOME: e.root + '/.local/accessibility/config',
        XDG_CACHE_HOME: e.root + '/.local/accessibility/cache',
        XDG_DATA_HOME: e.root + '/.local/accessibility/data',
        XDG_STATE_HOME: e.root + '/.local/accessibility/state',
      },
    });
    let exit: { code: number | null; signal: NodeJS.Signals | null } | undefined;
    reader.once('error', () => { exit = { code: null, signal: null }; });
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
      env: process.env, timeout: 20_000,
    });
    expect(stdout.trim()).toBe('heading=yes;button=yes');

    await expect(browser.page.getByRole('heading', { name: 'Votre espace est prêt' })).toBeVisible({ timeout: 240_000 });
    await expect(browser.page.getByRole('heading', { name: 'Suivre la préparation' })).toBeFocused();
    const initialVisual = await browser.page.evaluate(() => ({ width: document.documentElement.clientWidth, dpr: window.devicePixelRatio }));
    const xdotool = '/usr/bin/xdotool';
    const xdotoolEnv = process.env;
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
    await expect(browser.page.getByRole('button', { name: 'Activer mon espace' })).toBeFocused();
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
    await waitForActionBudget(browser.page, 2);
    const beforeWindowActivation = await browser.page.evaluate(() => ({ documentFocused: document.hasFocus() }));
    console.log('T08_CONFIRMATION_WINDOW_BEFORE ' + JSON.stringify(beforeWindowActivation));
    await browser.page.bringToFront();
    await run(xdotool, ['windowactivate', '--sync', windowId], { env: xdotoolEnv });
    await browser.page.waitForFunction(() => document.hasFocus());
    await browser.page.getByRole('button', { name: 'Activer mon espace' }).focus();
    await browser.page.keyboard.press('Enter');
    await expect(browser.page.getByRole('heading', { name: 'Confirmer l’activation' })).toBeFocused();
    await expect(browser.page.locator('.activation-confirmation strong')).toHaveText(longAgencyName);
    await browser.page.keyboard.press('Tab');
    await expect(browser.page.getByRole('button', { name: 'Confirmer l’activation', exact: true })).toBeFocused();
    const confirmationVisual = await browser.page.evaluate(() => {
      const luminance = (value: string) => {
        const channels = (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).map(channel => { const n = channel / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; });
        return channels[0]! * .2126 + channels[1]! * .7152 + channels[2]! * .0722;
      };
      const ratio = (a: string, b: string) => { const pair = [luminance(a), luminance(b)].sort((a, b) => b - a); return (pair[0]! + .05) / (pair[1]! + .05); };
      const panel = getComputedStyle(document.querySelector('.activation-confirmation')!);
      const active = document.activeElement;
      if (!active?.matches('.activation-confirmation button') || active.textContent?.trim() !== 'Confirmer l’activation') throw new Error('CONFIRMATION_FOCUS_CHANGED');
      const button = getComputedStyle(active);
      const documentFocused = document.hasFocus();
      const matchesFocus = active.matches(':focus');
      const matchesFocusVisible = active.matches(':focus-visible');
      const confirmationFocusRule = Array.from(document.styleSheets).some(sheet => {
        try { return Array.from(sheet.cssRules).some(rule => rule instanceof CSSStyleRule && rule.selectorText.includes('.activation-confirmation button:focus')); }
        catch { return false; }
      });
      const outlineProperties = ['outline', 'outline-width', 'outline-style', 'outline-color', 'outline-offset'] as const;
      const declarationProperties = [...outlineProperties, 'all', 'box-shadow'] as const;
      // Only public CSS values for the focus indicator: never serialize a style, selector, URL or DOM node.
      const safeStyleValue = (value: string) => value.length <= 160 && /^[\w\s#.,()%+/-]*$/.test(value) && !/url\s*\(/i.test(value) ? value : 'UNEXPECTED_STYLE_VALUE';
      const declarations = (style: CSSStyleDeclaration, properties: readonly string[]) => properties.flatMap(property => {
        const value = style.getPropertyValue(property);
        return value ? [{ property, value: safeStyleValue(value), important: style.getPropertyPriority(property) === 'important' }] : [];
      });
      type Condition = { kind: 'media' | 'supports'; matches: boolean };
      type CascadeRow = { sheet: number; order: number[]; disabled: boolean; conditions: Condition[]; applicable: boolean; declarations: ReturnType<typeof declarations> };
      const cascade: CascadeRow[] = [];
      let inaccessibleStyleSheets = 0, unreadableRuleLists = 0, invalidSelectors = 0, cascadeTruncated = false;
      const visitRules = (rules: CSSRuleList, sheet: number, disabled: boolean, conditions: Condition[], order: number[], depth: number): void => {
        if (depth > 6 || cascade.length >= 24) { cascadeTruncated = true; return; }
        for (let index = 0; index < rules.length; index += 1) {
          if (cascade.length >= 24) { cascadeTruncated = true; return; }
          const rule = rules[index]!, ruleOrder = [...order, index];
          let nextConditions = conditions;
          if (rule instanceof CSSMediaRule) nextConditions = [...conditions, { kind: 'media', matches: matchMedia(rule.conditionText).matches }];
          else if (rule instanceof CSSSupportsRule) nextConditions = [...conditions, { kind: 'supports', matches: CSS.supports(rule.conditionText) }];
          if (rule instanceof CSSStyleRule) {
            const values = declarations(rule.style, declarationProperties);
            if (values.length) {
              let matches = false;
              try { matches = active.matches(rule.selectorText); } catch { invalidSelectors += 1; }
              if (matches) cascade.push({ sheet, order: ruleOrder, disabled, conditions: nextConditions, applicable: !disabled && nextConditions.every(condition => condition.matches), declarations: values });
            }
          }
          if (rule instanceof CSSImportRule && rule.styleSheet) {
            const importedConditions: Condition[] = rule.media.mediaText ? [...nextConditions, { kind: 'media', matches: matchMedia(rule.media.mediaText).matches }] : nextConditions;
            const supportsConditions: Condition[] = rule.supportsText ? [...importedConditions, { kind: 'supports', matches: CSS.supports(rule.supportsText) }] : importedConditions;
            try { visitRules(rule.styleSheet.cssRules, sheet, disabled || rule.styleSheet.disabled, supportsConditions, ruleOrder, depth + 1); }
            catch { inaccessibleStyleSheets += 1; }
          }
          if ('cssRules' in rule) {
            try { visitRules((rule as CSSGroupingRule).cssRules, sheet, disabled, nextConditions, ruleOrder, depth + 1); }
            catch { unreadableRuleLists += 1; }
          }
        }
      };
      Array.from(document.styleSheets).forEach((sheet, index) => {
        const conditions: Condition[] = sheet.media.mediaText ? [{ kind: 'media', matches: matchMedia(sheet.media.mediaText).matches }] : [];
        try { visitRules(sheet.cssRules, index, sheet.disabled, conditions, [], 0); }
        catch { inaccessibleStyleSheets += 1; }
      });
      const inlineOutline = declarations((active as HTMLElement).style, outlineProperties);
      const animationCount = active.getAnimations().length;
      const card = getComputedStyle(document.querySelector('.card')!);
      const background = panel.backgroundColor === 'rgba(0, 0, 0, 0)' ? card.backgroundColor : panel.backgroundColor;
      return { text: ratio(panel.color, background), button: ratio(button.color, button.backgroundColor), focus: ratio(button.outlineColor, background), focused: documentFocused && matchesFocus, documentFocused, matchesFocus, matchesFocusVisible, confirmationFocusRule, forcedColors: matchMedia('(forced-colors: active)').matches, outlineColor: button.outlineColor, backgroundColor: background, dsFocusColor: button.getPropertyValue('--color-focus').trim(), outline: button.outlineWidth, outlineStyle: button.outlineStyle, target: document.querySelector('.activation-confirmation button')!.getBoundingClientRect().height,
        outlineShorthand: safeStyleValue(button.outline), outlineOffset: safeStyleValue(button.outlineOffset), boxShadow: safeStyleValue(button.boxShadow), buttonBackground: safeStyleValue(button.backgroundColor), buttonBorderColors: [button.borderTopColor, button.borderRightColor, button.borderBottomColor, button.borderLeftColor].map(safeStyleValue), inlineOutline, cascade, inaccessibleStyleSheets, unreadableRuleLists, invalidSelectors, cascadeTruncated, animationCount, hasAnimations: animationCount > 0,
        width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, dpr: devicePixelRatio, nameCodePoints: Array.from(document.querySelector('.activation-confirmation strong')!.textContent ?? '').length };
    });
    console.log('T08_CONFIRMATION_FOCUS_DIAGNOSTIC ' + JSON.stringify(confirmationVisual));
    expect(confirmationVisual.documentFocused).toBe(true); expect(confirmationVisual.matchesFocus).toBe(true);
    expect(confirmationVisual.dpr / initialVisual.dpr).toBeGreaterThanOrEqual(1.95);
    expect(confirmationVisual.dpr / initialVisual.dpr).toBeLessThanOrEqual(2.05);
    expect(confirmationVisual.nameCodePoints).toBe(120);
    expect(confirmationVisual.scroll).toBeLessThanOrEqual(confirmationVisual.width);
    expect(confirmationVisual.text).toBeGreaterThanOrEqual(4.5); expect(confirmationVisual.button).toBeGreaterThanOrEqual(4.5);
    expect(confirmationVisual.focused).toBe(true); expect(confirmationVisual.outlineStyle).toBe('solid');
    expect(confirmationVisual.focus).toBeGreaterThanOrEqual(3); expect(confirmationVisual.outline).not.toBe('0px'); expect(confirmationVisual.target).toBeGreaterThanOrEqual(44);
    await run(xdotool, ['key', '--clearmodifiers', 'ctrl+0'], { env: xdotoolEnv });
    await browser.page.setViewportSize({ width: 320, height: 740 });
    expect(await browser.page.evaluate(() => ({ width: innerWidth, fits: document.documentElement.scrollWidth <= innerWidth }))).toEqual({ width: 320, fits: true });
    await expect(browser.page.locator('.activation-confirmation strong')).toHaveText(longAgencyName);
    await expect(browser.page.getByText('Cette action rendra l’espace actif. Aucune fonction IA ni connexion e-mail ne sera activée.')).toBeVisible();
    await browser.page.keyboard.press('Tab'); await expect(browser.page.getByRole('button', { name: 'Revenir' })).toBeFocused();
    await browser.page.keyboard.press('Enter'); await expect(browser.page.getByRole('button', { name: 'Activer mon espace' })).toBeFocused();
    await new Promise(resolve => setTimeout(resolve, 1500));
    const confirmationUtterances = await readFile(debugPath, 'utf8');
    expect(confirmationUtterances.includes('Confirmer l’activation')).toBe(true);
    await writeFile(proofDir + '/pr3-confirmation-rendered-a11y.json', JSON.stringify({ zoom: 200, reflow: 320, confirmationVisual, reader: 'automated-only' }, null, 2) + '\n', { mode: 0o600 });
    const expectedUi = ['Suivre la préparation', 'Votre espace est prêt', 'Vérifier l’état'];
    for (const phrase of expectedUi) expect(utterances.includes(phrase)).toBe(true);
    expect(/password|mot de passe|otp|recovery|secret|code de vérification/i.test(utterances)).toBe(false);
  } finally {
    try { await stopOwnedReader(reader, readerCapture); } finally { await browser.context.close(); }
  }
});

/** Do not let a reader from this case observe credentials in the next native MFA flow. */
async function stopOwnedReader(reader: ReturnType<typeof spawn> | undefined, capture: string | undefined) {
  if (!reader && !capture) return;
  if (!reader || !capture) throw new Error('OWNED_READER_EXIT_UNCONFIRMED');
  if (reader.exitCode === null && reader.signalCode === null) await new Promise<void>((resolve, reject) => {
    const exited = () => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(() => { reader.removeListener('exit', exited); reject(new Error('OWNED_READER_EXIT_UNCONFIRMED')); }, 5000);
    reader.once('exit', exited);
    try {
      if (reader.exitCode !== null || reader.signalCode !== null) exited();
      else reader.kill('SIGTERM'); // A signal request is not a receipt; only exit resolves the wait.
    } catch { clearTimeout(timer); reader.removeListener('exit', exited); reject(new Error('OWNED_READER_STOP_REFUSED')); }
  });
  if (reader.exitCode === null && reader.signalCode === null) throw new Error('OWNED_READER_EXIT_UNCONFIRMED');
  await confirmOwnedReaderExit(capture);
}


async function createFailedForRetry(page: Page, name: string) {
  const invitation = await nativePendingInvitation();
  const credentials = await enrollNative(page, invitation, () => {});
  await page.getByRole('button', { name: 'Continuer avec mon invitation' }).click();
  await page.getByLabel('Nom de l’espace').waitFor();
  await declareCreateIntent(invitation, 't07');
  await page.getByLabel('Nom de l’espace').fill(name);
  const fixture = await qualifyRetryableFailed(async () => {
    const pending = page.waitForResponse(response => new URL(response.url()).pathname === '/v1/agencies' && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Créer mon espace' }).click();
    const response = await pending;
    if (response.status() !== 202) throw new Error('RETRY_NATIVE_CREATION_REFUSED');
    const created = await response.json() as { agencyId: string; operationId: string };
    await captureCreatedAgency(); // Durable result captured before any waiting or subsequent gesture.
    return created;
  });
  await waitForActionBudget(page, 5);
  await page.getByRole('button', { name: 'Vérifier l’état', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reprendre la préparation', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Activer mon espace', exact: true })).toHaveCount(0);
  return { ...fixture, invitation, credentials };
}
function observeRetry(page: Page, agencyId: string) {
  const keys: string[] = [], commands: { csrf: boolean; key: boolean; version: boolean; body: boolean }[] = [];
  const preReadCounts: number[] = [];
  let reads = 0, acceptedSeen = false;
  const path = '/v1/agencies/' + agencyId + '/provisioning/retry';
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/v1/agencies/' + agencyId + '/activation' && request.method() === 'GET') reads += 1;
    if (new URL(request.url()).pathname !== path || request.method() !== 'POST') return;
    const headers = request.headers();
    preReadCounts.push(reads);
    keys.push(headers['idempotency-key'] ?? '');
    commands.push({ csrf: /^[A-Za-z0-9_-]{43}$/.test(headers['x-csrf-token'] ?? ''), key: /^[0-9a-f-]{36}$/.test(headers['idempotency-key'] ?? ''),
      version: /^"[1-9][0-9]*"$/.test(headers['if-match'] ?? ''), body: request.postData() === '{}' });
  });
  page.on('response', response => { if (new URL(response.url()).pathname === path && response.request().method() === 'POST' && response.status() === 202) acceptedSeen = true; });
  return { path, keys, commands, preReadCounts, readCount: () => reads, acceptedSeen: () => acceptedSeen };
}
async function openRetry(page: Page) {
  await waitForActionBudget(page, 5);
  await page.getByRole('button', { name: 'Reprendre la préparation', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Confirmer la reprise', exact: true })).toBeFocused();
  await expect(page.getByText('Aucune activation ni fonction IA n’est déclenchée par cette demande.')).toBeVisible();
}
async function expectRetryReady(page: Page, fixture: { agencyId: string; operationId: string }) {
  await expect(page.getByRole('heading', { name: 'Votre espace est prêt', exact: true })).toBeVisible({ timeout: 180_000 });
  await expect(page.getByRole('heading', { name: 'Votre espace est activé', exact: true })).toHaveCount(0);
  await expect.poll(async () => {
    const row = await retryDurableEvidence(fixture);
    return { state: row.state, attempt: row.attempt, humanRetries: row.human_retries };
  }, { timeout: 15_000 }).toEqual({ state: 'READY', attempt: 2, humanRetries: 1 });
}

test('T08 reprend un vrai FAILED avec confirmation accessible, refus courants et double clic sans activation', async () => {
  test.setTimeout(540_000);
  const browser = await nativePage({ headless: false, zoom200: true });
  let reader: ReturnType<typeof spawn> | undefined;
  let readerCapture: string | undefined;
  try {
    const longName = 'W'.repeat(120);
    const fixture = await createFailedForRetry(browser.page, longName);
    const probe = observeRetry(browser.page, fixture.agencyId);
    const debugPath = e.root + '/.local/accessibility/orca-pr4-' + randomUUID() + '.log';
    readerCapture = await beginOwnedReaderCapture();
    reader = spawn('/usr/bin/python3', ['/usr/bin/orca', '--replace', '--debug-file', debugPath], { cwd: e.root, stdio: 'ignore', env: process.env });
    let readerFailed = false; reader.once('error', () => { readerFailed = true; });
    await new Promise(resolve => setTimeout(resolve, 2500));
    expect(readerFailed).toBe(false); expect(reader.exitCode).toBeNull(); expect(reader.signalCode).toBeNull();
    // Node's pinned TS stripping needs a resolver for the test sources' emitted .js import names.
    const barrierCode = [
      "import{registerHooks}from'node:module';import{existsSync}from'node:fs';import{fileURLToPath}from'node:url';",
      "registerHooks({resolve(specifier,context,next){if(specifier.startsWith('.')&&specifier.endsWith('.js')&&context.parentURL?.includes('/tests/')){const target=new URL(specifier.slice(0,-3)+'.ts',context.parentURL);if(existsSync(fileURLToPath(target)))return next(target.href,context);}return next(specifier,context);}});",
      "let guard;try{({assertNoActiveReader:guard}=await import('./tests/e2e/private-s01-fixture.ts'));}catch{process.stdout.write('BOOTSTRAP_FAILED');process.exitCode=1;}",
      "if(guard){try{await guard();process.stdout.write('UNEXPECTED_ALLOW')}catch(error){process.stdout.write(error instanceof Error&&error.message==='OWNED_READER_AUTH_BARRIER_REFUSED'?'BLOCKED':'UNEXPECTED_FAILURE');}}",
    ].join('\n');
    let barrierOutput: string;
    try { barrierOutput = (await run(e.root + '/.local/node/bin/node', ['--input-type=module', '-e', barrierCode], { cwd: e.root, timeout: 10_000 })).stdout; }
    catch { throw new Error('OWNED_READER_PROCESS_PROBE_FAILED'); }
    expect(barrierOutput).toBe('BLOCKED');
    const windowId = (await run('/usr/bin/xdotool', ['search', '--onlyvisible', '--class', 'firefox'])).stdout.trim().split('\n').at(-1);
    if (!windowId) throw new Error('RETRY_ACCESSIBILITY_WINDOW_UNAVAILABLE');
    await browser.page.bringToFront();
    await run('/usr/bin/xdotool', ['windowactivate', '--sync', windowId]);
    await run('/usr/bin/xdotool', ['key', '--clearmodifiers', 'ctrl+0']);
    const initialDpr = await browser.page.evaluate(() => devicePixelRatio);
    for (let step = 0; step < 12; step += 1) {
      await run('/usr/bin/xdotool', ['key', '--clearmodifiers', 'ctrl+plus']);
      await browser.page.waitForTimeout(120);
      if (await browser.page.evaluate(dpr => devicePixelRatio / dpr >= 2, initialDpr)) break;
    }
    for (let step = 0; step < 4 && await browser.page.evaluate(dpr => devicePixelRatio / dpr > 2.05, initialDpr); step += 1) {
      await run('/usr/bin/xdotool', ['key', '--clearmodifiers', 'ctrl+minus']); await browser.page.waitForTimeout(120);
    }
    await browser.page.emulateMedia({ reducedMotion: 'reduce' });
    await openRetry(browser.page);
    await expect(browser.page.locator('.activation-confirmation strong')).toHaveText(longName);
    await browser.page.keyboard.press('Tab');
    await expect(browser.page.getByRole('button', { name: 'Confirmer la reprise', exact: true })).toBeFocused();
    const rendered = await browser.page.evaluate(() => {
      const luminance = (value: string) => {
        const c = (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).map(v => { const n = v / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; });
        return c[0]! * .2126 + c[1]! * .7152 + c[2]! * .0722;
      };
      const ratio = (a: string, b: string) => { const values = [luminance(a), luminance(b)].sort((a, b) => b - a); return (values[0]! + .05) / (values[1]! + .05); };
      const active = document.activeElement;
      if (!active?.matches('.activation-confirmation button') || active.textContent?.trim() !== 'Confirmer la reprise') throw new Error('RETRY_FOCUS_CHANGED');
      const button = getComputedStyle(active), panel = getComputedStyle(document.querySelector('.activation-confirmation')!);
      return { focused: document.hasFocus() && active.matches(':focus'), focus: ratio(button.outlineColor, panel.backgroundColor), text: ratio(panel.color, panel.backgroundColor), button: ratio(button.color, button.backgroundColor),
        outline: button.outlineWidth, outlineStyle: button.outlineStyle, animations: active.getAnimations().length, target: active.getBoundingClientRect().height,
        width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, dpr: devicePixelRatio, nameLength: Array.from(document.querySelector('.activation-confirmation strong')!.textContent ?? '').length };
    });
    console.log('T08_RETRY_RENDERED ' + JSON.stringify(rendered));
    expect(rendered.focused).toBe(true); expect(rendered.outlineStyle).toBe('solid'); expect(rendered.outline).not.toBe('0px');
    expect(rendered.animations).toBe(0); expect(rendered.focus).toBeGreaterThanOrEqual(3); expect(rendered.text).toBeGreaterThanOrEqual(4.5); expect(rendered.button).toBeGreaterThanOrEqual(4.5); expect(rendered.target).toBeGreaterThanOrEqual(44);
    expect(rendered.dpr / initialDpr).toBeGreaterThanOrEqual(1.95); expect(rendered.dpr / initialDpr).toBeLessThanOrEqual(2.05); expect(rendered.nameLength).toBe(120); expect(rendered.scroll).toBeLessThanOrEqual(rendered.width);
    await run('/usr/bin/xdotool', ['key', '--clearmodifiers', 'ctrl+0']);
    await browser.page.setViewportSize({ width: 320, height: 740 });
    expect(await browser.page.evaluate(() => ({ width: innerWidth, fits: document.documentElement.scrollWidth <= innerWidth }))).toEqual({ width: 320, fits: true });
    await expect(browser.page.locator('.activation-confirmation strong')).toHaveText(longName);
    await browser.page.keyboard.press('Tab'); await expect(browser.page.getByRole('button', { name: 'Annuler', exact: true })).toBeFocused();
    await browser.page.keyboard.press('Enter'); await expect(browser.page.getByRole('button', { name: 'Reprendre la préparation', exact: true })).toBeFocused();
    expect(probe.commands.length).toBe(0);
    await expect.poll(async () => (await readFile(debugPath, 'utf8')).includes('Confirmer la reprise'), { timeout: 15_000 }).toBe(true);
    const utterances = await readFile(debugPath, 'utf8'); expect(/password|mot de passe|otp|recovery|secret|code de vérification/i.test(utterances)).toBe(false);
    expect(reader.exitCode).toBeNull(); expect(reader.signalCode).toBeNull();
    const proofRoot = e.root + '/.agentic-local/docs/agentic/work/79-s01-t08-build/proofs';
    await mkdir(proofRoot, { recursive: true, mode: 0o700 });
    await writeFile(proofRoot + '/pr4-retry-rendered.json', JSON.stringify({ rendered, reflow: 320, zoom: 200, reader: 'automated-only', cancelledWithoutMutation: true }) + '\n', { mode: 0o600 });

    // Server refusals use the real session and commands; only minimized results leave the page.
    await waitForActionBudget(browser.page, 6);
    const refused = await browser.page.evaluate(async ({ path, agencyId }) => {
      const session = await (await fetch('/v1/session', { cache: 'no-store' })).json() as { csrfToken: string };
      const read = async () => (await (await fetch('/v1/agencies/' + agencyId + '/activation', { cache: 'no-store' })).json()) as { state: string; version: string };
      const before = await read();
      const command = async (version: string, csrf?: string) => {
        const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), 'If-Match': '"' + version + '"', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) }, body: '{}' });
        return response.status;
      };
      const stale = await command('0', session.csrfToken), missing = await command(before.version);
      const wrong = await command(before.version, (session.csrfToken[0] === 'A' ? 'B' : 'A') + session.csrfToken.slice(1));
      const after = await read();
      return { stale, missing, wrong, unchanged: before.state === 'FAILED' && after.state === 'FAILED' && before.version === after.version };
    }, { path: probe.path, agencyId: fixture.agencyId });
    expect(refused).toEqual({ stale: 409, missing: 400, wrong: 403, unchanged: true });
    expect((await retryDurableEvidence(fixture)).human_retries).toBe(0);
    // Wait out the real server window; never erase or enlarge the browser budget.
    await new Promise(resolve => setTimeout(resolve, 61_000));
    await waitForActionBudget(browser.page, 6);
    for (let i = 0; i < 6; i += 1) {
      await browser.page.getByRole('button', { name: 'Vérifier l’état', exact: true }).click();
      await expect(browser.page.locator('main')).toHaveAttribute('aria-busy', 'false');
    }
    await browser.page.getByRole('button', { name: 'Reprendre la préparation', exact: true }).click();
    await expect(browser.page.getByRole('alert')).toContainText('Trop de vérifications ont été effectuées.');
    await expect(browser.page.getByRole('button', { name: 'Vérifier l’état', exact: true })).toHaveCount(1);
    const beforeHuman = probe.commands.length;
    const postReadChecks: { noReady: boolean; noActive: boolean; centralState: string }[] = [];
    await browser.page.route('**/v1/agencies/' + fixture.agencyId + '/activation', async route => {
      if (!probe.acceptedSeen() || postReadChecks.length || route.request().method() !== 'GET') return route.continue();
      const response = await safeSyntheticResponse(() => route.fetch());
      const body = await safeSyntheticResponse(() => response.json()) as { state: string };
      if (response.status() !== 200 || !['PROVISIONING', 'READY'].includes(body.state)) throw new Error('RETRY_POST_READ_REFUSED');
      const projected = await browser.page.evaluate(() => ({ noReady: !document.querySelector('#activation-heading')?.textContent?.includes('Votre espace est prêt'), noActive: !document.querySelector('#activation-heading')?.textContent?.includes('Votre espace est activé') }));
      postReadChecks.push({ ...projected, centralState: body.state });
      await route.fulfill({ response });
    });
    await openRetry(browser.page);
    const accepted = browser.page.waitForResponse(response => new URL(response.url()).pathname === probe.path && response.request().method() === 'POST');
    await browser.page.getByRole('button', { name: 'Confirmer la reprise', exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
    const response = await accepted;
    expect(response.status()).toBe(202);
    const body = await response.json() as { agencyId: string; operationId: string; state: string };
    expect(body.agencyId === fixture.agencyId && body.operationId === fixture.operationId && body.state === 'PROVISIONING').toBe(true);
    await expectRetryReady(browser.page, fixture);
    expect(postReadChecks.length).toBe(1); expect(postReadChecks[0]?.noReady).toBe(true); expect(postReadChecks[0]?.noActive).toBe(true);
    expect(probe.commands.length - beforeHuman).toBe(1);
    expect(probe.commands.at(-1)).toEqual({ csrf: true, key: true, version: true, body: true });
  } finally { try { await stopOwnedReader(reader, readerCapture); } finally { await browser.context.close(); } }
});

test('T08 conserve la même intention de reprise après perte avant émission et relit avant le nouveau geste', async () => {
  test.setTimeout(540_000);
  const browser = await nativePage();
  try {
    const fixture = await createFailedForRetry(browser.page, 'Reprise avec intention conservée');
    const probe = observeRetry(browser.page, fixture.agencyId);
    let blocked = false, committed = false;
    await browser.page.route('**' + probe.path, async route => {
      if (route.request().method() !== 'POST') return route.continue();
      if (!blocked) { blocked = true; await route.abort('failed'); return; }
      const response = await safeSyntheticResponse(() => route.fetch());
      const body = await safeSyntheticResponse(() => response.json()) as { state: string };
      committed = response.status() === 202 && body.state === 'PROVISIONING';
      await route.fulfill({ response });
    });
    await openRetry(browser.page);
    await browser.page.getByRole('button', { name: 'Confirmer la reprise', exact: true }).click();
    await expect(browser.page.getByRole('alert')).toContainText('Le résultat de la reprise est incertain.');
    expect(probe.commands.length).toBe(1); expect((await retryDurableEvidence(fixture)).human_retries).toBe(0);
    await browser.page.waitForTimeout(1200); expect(probe.commands.length).toBe(1);
    await waitForActionBudget(browser.page, 3);
    await browser.page.getByRole('button', { name: 'Confirmer la reprise', exact: true }).click();
    await expectRetryReady(browser.page, fixture);
    expect(committed).toBe(true); expect(probe.commands.length).toBe(2);
    expect(probe.keys[0] === probe.keys[1]).toBe(true);
    expect(probe.preReadCounts[1]! > probe.preReadCounts[0]!).toBe(true);
    expect(probe.commands.every(command => Object.values(command).every(Boolean))).toBe(true);
  } finally { await browser.context.close(); }
});

test('T08 réconcilie une reprise202 réellement perdue par GET sans replay après offline et refresh', async () => {
  test.setTimeout(540_000);
  const browser = await nativePage();
  try {
    const fixture = await createFailedForRetry(browser.page, 'Reprise durable réponse perdue');
    const probe = observeRetry(browser.page, fixture.agencyId);
    let committed = false;
    await browser.page.route('**' + probe.path, async route => {
      if (route.request().method() !== 'POST') return route.continue();
      const response = await safeSyntheticResponse(() => route.fetch());
      const body = await safeSyntheticResponse(() => response.json()) as { state: string; agencyId: string; operationId: string };
      committed = response.status() === 202 && body.state === 'PROVISIONING' && body.agencyId === fixture.agencyId && body.operationId === fixture.operationId;
      if (!committed) throw new Error('RETRY_DURABLE_RESPONSE_UNEXPECTED');
      await route.abort('failed');
    });
    await openRetry(browser.page);
    await browser.page.getByRole('button', { name: 'Confirmer la reprise', exact: true }).click();
    await expect(browser.page.getByRole('alert')).toContainText('Le résultat de la reprise est incertain.');
    expect(committed).toBe(true); expect(probe.commands.length).toBe(1);
    await browser.context.setOffline(true);
    await browser.page.getByRole('button', { name: 'Vérifier l’état', exact: true }).click();
    await expect(browser.page.getByRole('alert')).toContainText('Impossible de vérifier cet espace.');
    await expect(browser.page.getByRole('button', { name: 'Confirmer la reprise', exact: true })).toBeVisible();
    expect(probe.commands.length).toBe(1);
    await browser.context.setOffline(false);
    await waitForActionBudget(browser.page, 3);
    const readsBeforeReconciliation = probe.readCount();
    await browser.page.getByRole('button', { name: 'Confirmer la reprise', exact: true }).click();
    await expect(browser.page.getByRole('button', { name: 'Confirmer la reprise', exact: true })).toHaveCount(0);
    expect(probe.commands.length).toBe(1);
    expect(probe.readCount() > readsBeforeReconciliation).toBe(true);
    await browser.page.reload();
    await expectRetryReady(browser.page, fixture);
    expect(probe.commands.length).toBe(1); expect(probe.commands[0]).toEqual({ csrf: true, key: true, version: true, body: true });
  } finally { await browser.context.setOffline(false); await browser.context.close(); }
});

test('T08 refuse une reprise étrangère puis revalide session expirée et MFA avant toute reprise humaine', async () => {
  test.setTimeout(540_000);
  const browser = await nativePage(), foreign = await nativePage();
  try {
    const other = await createReadyForAction(foreign.page, 'Espace étranger reprise refusée');
    const fixture = await createFailedForRetry(browser.page, 'Reprise après session courante');
    const probe = observeRetry(browser.page, fixture.agencyId);
    const foreignDenied = await foreign.page.evaluate(async target => {
      const session = await (await fetch('/v1/session', { cache: 'no-store' })).json() as { csrfToken: string };
      const response = await fetch('/v1/agencies/' + target + '/provisioning/retry', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken, 'Idempotency-Key': crypto.randomUUID(), 'If-Match': '"1"' }, body: '{}' });
      return response.status;
    }, fixture.agencyId);
    expect([403, 404].includes(foreignDenied)).toBe(true);
    await foreign.page.goto(origin + '/app/agencies/' + fixture.agencyId + '/activation');
    await expect(foreign.page.getByRole('alert')).toContainText('Cet espace n’est pas disponible pour cette session.');
    await expect(foreign.page.getByRole('button', { name: 'Reprendre la préparation', exact: true })).toHaveCount(0);
    expect((await retryDurableEvidence(fixture)).human_retries).toBe(0);
    expect(other.agencyId !== fixture.agencyId).toBe(true);
    await openRetry(browser.page);
    const cookie = (await browser.context.cookies(origin)).find(item => item.name === '__Host-dossiercle');
    if (!cookie) throw new Error('RETRY_NATIVE_COOKIE_UNAVAILABLE');
    await expireNativeBffSession(cookie.value);
    await browser.page.getByRole('button', { name: 'Confirmer la reprise', exact: true }).click();
    await expect(browser.page.getByRole('alert')).toContainText('Cet espace n’est pas disponible pour cette session.');
    await expect(browser.page.locator('.agency-name')).toHaveCount(0); expect(probe.commands.length).toBe(0);
    await browser.page.locator('#activation-error-summary').getByRole('button', { name: 'Retour à la préparation' }).click();
    await expect(browser.page.getByRole('button', { name: 'Se reconnecter' })).toBeVisible();
    await uiReauthenticate(browser.page, fixture.invitation, fixture.credentials);
    await expect(browser.page.getByRole('button', { name: 'Reprendre la préparation', exact: true })).toBeVisible();
    expect(probe.commands.length).toBe(0);
    await openRetry(browser.page);
    await browser.page.getByRole('button', { name: 'Confirmer la reprise', exact: true }).click();
    await expectRetryReady(browser.page, fixture); expect(probe.commands.length).toBe(1);
  } finally { await foreign.context.close(); await browser.context.close(); }
});
