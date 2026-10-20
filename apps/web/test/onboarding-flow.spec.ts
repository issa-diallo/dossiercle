import { describe, expect, it, vi } from 'vitest';
import type { AcceptedAgency } from '@dossiercle/contracts';
import { RequestBudget, bootstrapReauthContext, bootstrapRetryDelay, claim, createAgency, getOnboarding, parseApiFailure, startBootstrapReauth } from '../src/lib/agency-api.js';
import { ActivationActionGate, activationCanOpenConfirmation, activationIsConfirmed, activationLabel, activationOfferVisible, canViewActivation, confirmationMatches, reconcile, runActivationCommand, submitAgencyCreation, type ActivationConfirmation } from '../src/lib/onboarding-flow.js';
import { startActivationPolling } from '../src/lib/activation-polling.js';
import type { Activation } from '@dossiercle/contracts';

describe('onboarding projection and request discipline', () => {
  const session = { scope: 'onboarding' as const, agencyId: null, csrfToken: 'a'.repeat(43), idleExpiresAt: '2026-10-19T11:00:00Z', absoluteExpiresAt: '2026-10-20T11:00:00Z' };
  const agency = { agencyId: '0f8fad5b-d9cb-469f-a165-70867728950e', operationId: '0f8fad5b-d9cb-469f-a165-70867728950f', state: 'PROVISIONING' as const, version: '1', statusUrl: '/v1/agencies/0f8fad5b-d9cb-469f-a165-70867728950e/activation' };
  it('discovers agency from server and denies a session bound to another agency', () => {
    expect(reconcile(session, null).state).toBe('claim');
    expect(reconcile(session, agency).state).toBe('created');
    const active = { ...session, scope: 'agency' as const, agencyId: agency.agencyId };
    expect(reconcile(active, null)).toMatchObject({ state: 'created', agencyId: agency.agencyId });
    expect(canViewActivation(active, agency.agencyId)).toBe(true);
    expect(canViewActivation(active, '0f8fad5b-d9cb-469f-a165-70867728950f')).toBe(false);
  });
  it('maps READY to a safe read-only message, never an activation action', () => {
    const result = activationLabel({ agencyId: agency.agencyId, name: 'Espace', state: 'READY', step: 'READY', version: '2', errorCode: null, retryable: false, canActivate: true, canRetry: false, automationEnabled: false });
    expect(result.text).toBe('Votre espace est prêt à être activé.');
    expect(activationOfferVisible({ agencyId: agency.agencyId, name: 'Espace', state: 'READY', step: 'READY', version: '2', errorCode: null, retryable: false, canActivate: true, canRetry: false, automationEnabled: false })).toBe(true);
    const checking: Activation = { agencyId: agency.agencyId, name: 'Espace', state: 'READY', step: 'READY', version: '2', errorCode: null, retryable: false, canActivate: false, canRetry: false, automationEnabled: false };
    expect(activationLabel(checking).text).toBe('Vérification en cours avant activation.');
    expect(activationOfferVisible(checking)).toBe(false);
    expect(activationCanOpenConfirmation(checking, '2')).toBe(false);
    expect(activationCanOpenConfirmation({ ...checking, canActivate: true }, '2')).toBe(true);
    expect(activationCanOpenConfirmation({ ...checking, canActivate: true, version: '3' }, '2')).toBe(false);
  });
  it('binds an activation confirmation to the same agency, READY state, version and in-memory session', () => {
    const confirmation: ActivationConfirmation = { agencyId: agency.agencyId, version: '2', csrfToken: 's'.repeat(43), idempotencyKey: '0f8fad5b-d9cb-469f-a165-70867728950f' };
    const ready: Activation = { agencyId: agency.agencyId, name: 'Espace', state: 'READY', step: 'READY', version: '2', errorCode: null, retryable: false, canActivate: true, canRetry: false, automationEnabled: false };
    expect(confirmationMatches(ready, confirmation)).toBe(true);
    expect(confirmationMatches({ ...ready, canActivate: false }, confirmation)).toBe(false);
    expect(confirmationMatches({ ...ready, version: '3' }, confirmation)).toBe(false);
    expect(confirmationMatches({ ...ready, state: 'ACTIVE' }, confirmation)).toBe(false);
    expect(confirmationMatches({ ...ready, agencyId: '0f8fad5b-d9cb-469f-a165-70867728950f' }, confirmation)).toBe(false);
    expect(activationIsConfirmed({ ...ready, state: 'ACTIVE' }, agency.agencyId)).toBe(true);
    expect(activationIsConfirmed({ ...ready, state: 'READY' }, agency.agencyId)).toBe(false);
  });
  it('locks synchronously, reads current authority before POST and never posts for ACTIVE or stale confirmation', async () => {
    const ready: Activation = { agencyId: agency.agencyId, name: 'Espace', state: 'READY', step: 'READY', version: '2', errorCode: null, retryable: false, canActivate: true, canRetry: false, automationEnabled: false };
    const active = { ...ready, state: 'ACTIVE' as const, step: 'ACTIVE' as const };
    const intent: ActivationConfirmation = { agencyId: agency.agencyId, version: '2', csrfToken: session.csrfToken, idempotencyKey: '0f8fad5b-d9cb-469f-a165-70867728950f' };
    const gate = new ActivationActionGate(); let releaseRead: ((value: { session: typeof session; activation: typeof ready }) => void) | undefined;
    const readCurrent = vi.fn(() => new Promise<{ session: typeof session; activation: typeof ready }>(resolve => { releaseRead = resolve; }));
    const activate = vi.fn(async () => active);
    const input = { gate, intent, targetAgencyId: agency.agencyId, isCurrent: () => true, readCurrent, activate };
    const pending = runActivationCommand(input);
    expect(pending).toBeDefined();
    expect(runActivationCommand(input)).toBeUndefined();
    expect(readCurrent).toHaveBeenCalledOnce();
    releaseRead?.({ session, activation: ready });
    await expect(pending).resolves.toMatchObject({ kind: 'activated', current: { activation: { state: 'ACTIVE' } } });
    expect(activate).toHaveBeenCalledOnce();
    expect(gate.acquire()).toBe(false);
    gate.release();

    const lifecycleGate = new ActivationActionGate();
    const deferredController = new AbortController();
    let publishedController: AbortController | undefined;
    let resolveDeferredRead: ((value: { session: typeof session; activation: Activation }) => void) | undefined;
    const lifecycleInput = {
      gate: lifecycleGate, intent, targetAgencyId: agency.agencyId,
      isCurrent: () => publishedController !== undefined && !publishedController.signal.aborted,
      onAcquired: () => { publishedController = deferredController; },
      readCurrent: () => new Promise<{ session: typeof session; activation: Activation }>(resolve => { resolveDeferredRead = resolve; }),
      activate,
    };
    const firstLifecycle = runActivationCommand(lifecycleInput);
    const duplicateLifecycle = runActivationCommand({ ...lifecycleInput, onAcquired: () => { publishedController = new AbortController(); } });
    expect(duplicateLifecycle).toBeUndefined();
    expect(publishedController).toBe(deferredController);
    deferredController.abort();
    resolveDeferredRead?.({ session, activation: ready });
    await expect(firstLifecycle).resolves.toEqual({ kind: 'stale' });
    expect(activate).toHaveBeenCalledOnce();
    lifecycleGate.release();

    for (const current of [
      { session, activation: active },
      { session: { ...session, csrfToken: 'b'.repeat(43) }, activation: ready },
      { session, activation: { ...ready, canActivate: false } },
      { session, activation: { ...ready, version: '3' } },
    ]) {
      const guardedGate = new ActivationActionGate();
      const result = runActivationCommand({ ...input, gate: guardedGate, readCurrent: async () => current });
      await expect(result).resolves.toMatchObject({ kind: current.activation.state === 'ACTIVE' ? 'already-active' : current.session.csrfToken !== intent.csrfToken ? 'session-changed' : 'changed' });
      expect(activate).toHaveBeenCalledOnce();
      guardedGate.release();
    }

    const staleGate = new ActivationActionGate();
    const stale = runActivationCommand({ ...input, gate: staleGate, readCurrent: async () => ({ session, activation: ready }), isCurrent: () => false });
    await expect(stale).resolves.toEqual({ kind: 'stale' });
    expect(activate).toHaveBeenCalledOnce();
    staleGate.release();
  });
  it('does not retry an uncertain activation automatically; an explicit replay reuses its in-memory key after a fresh read', async () => {
    const ready: Activation = { agencyId: agency.agencyId, name: 'Espace', state: 'READY', step: 'READY', version: '2', errorCode: null, retryable: false, canActivate: true, canRetry: false, automationEnabled: false };
    const active = { ...ready, state: 'ACTIVE' as const, step: 'ACTIVE' as const };
    const intent: ActivationConfirmation = { agencyId: agency.agencyId, version: '2', csrfToken: session.csrfToken, idempotencyKey: '0f8fad5b-d9cb-469f-a165-70867728950f' };
    const gate = new ActivationActionGate(); const readCurrent = vi.fn(async () => ({ session, activation: ready }));
    const keys: string[] = [];
    const activate = vi.fn(async (_csrf: string, key: string) => {
      keys.push(key);
      if (keys.length === 1) throw Object.assign(new Error('NETWORK_UNCERTAIN'), { status: 503 });
      return active;
    });
    const input = { gate, intent, targetAgencyId: agency.agencyId, isCurrent: () => true, readCurrent, activate };
    const uncertain = runActivationCommand(input);
    await expect(uncertain).rejects.toMatchObject({ status: 503 });
    expect(readCurrent).toHaveBeenCalledOnce(); expect(activate).toHaveBeenCalledOnce();
    gate.release();
    const replay = runActivationCommand(input);
    await expect(replay).resolves.toMatchObject({ kind: 'activated' });
    expect(readCurrent).toHaveBeenCalledTimes(2); expect(activate).toHaveBeenCalledTimes(2);
    expect(keys).toEqual([intent.idempotencyKey, intent.idempotencyKey]);
    gate.release();
  });
  it('explains that retry is temporarily unavailable for FAILED', () => {
    const result = activationLabel({ agencyId: agency.agencyId, name: 'Espace', state: 'FAILED', step: 'SCHEMA_READY', version: '2', errorCode: 'DEPENDENCY_UNAVAILABLE', retryable: true, canActivate: false, canRetry: true, automationEnabled: false });
    expect(result.text).toContain('La reprise n’est pas disponible actuellement.');
  });
  it.each([
    [{ state: 'PROVISIONING', step: 'ACCEPTED' }, 'Préparation de votre espace'],
    [{ state: 'READY', step: 'READY' }, 'Votre espace est prêt'],
    [{ state: 'ACTIVE', step: 'ACTIVE' }, 'Votre espace est activé'],
    [{ state: 'FAILED', step: 'SCHEMA_READY' }, 'Préparation à vérifier'],
  ] as const)('maps %s to a safe public state label', (state, heading) => {
    expect(activationLabel({ agencyId: agency.agencyId, name: 'Espace', ...state, version: '2', errorCode: null, retryable: false, canActivate: false, canRetry: false, automationEnabled: false })).toMatchObject({ heading });
  });
  it('applies a six request/minute budget and at most three polls', () => {
    let now = 0; const budget = new RequestBudget(() => now);
    expect([budget.reserve(true), budget.reserve(true), budget.reserve(true), budget.reserve(true)]).toEqual([true, true, true, false]);
    expect(budget.reserve()).toBe(true); expect(budget.reserve()).toBe(true); expect(budget.reserve()).toBe(true); expect(budget.reserve()).toBe(false);
    now = 60_001; expect(budget.reserve()).toBe(true);
  });
  it('retains only bounded request timestamps and poll flags across a same-tab reload', () => {
    let now = 1_000; const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const firstDocument = new RequestBudget(() => now, storage);
    expect([firstDocument.reserve(true), firstDocument.reserve(true), firstDocument.reserve(true), firstDocument.reserve(), firstDocument.reserve(), firstDocument.reserve()]).toEqual([true, true, true, true, true, true]);
    const saved = JSON.parse(values.get('dossiercle:t05-client-quota:v1') ?? 'null') as Record<string, unknown>;
    expect(Object.keys(saved).sort()).toEqual(['calls', 'polls', 'version']);
    expect(saved.calls).toEqual([1_000, 1_000, 1_000, 1_000, 1_000, 1_000]); expect(saved.polls).toEqual([1_000, 1_000, 1_000]);
    const reloadedDocument = new RequestBudget(() => now, storage); expect(reloadedDocument.reserve()).toBe(false);
    now = 61_001; expect(reloadedDocument.reserve()).toBe(true);
    const expiredStorage = { getItem: () => JSON.stringify({ version: 1, calls: [1_000, 1_000], polls: [1_000] }), setItem: () => {} };
    expect(new RequestBudget(() => now, expiredStorage).reserve()).toBe(true);
  });
  it('persists bootstrap cooldown deadlines across reload and fails closed on malformed metadata', async () => {
    vi.useFakeTimers(); vi.setSystemTime(100_000);
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    vi.stubGlobal('window', { sessionStorage: storage });
    const firstFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 429, headers: { 'Retry-After': '15' } })); vi.stubGlobal('fetch', firstFetch);
    try {
      vi.resetModules(); const first = await import('../src/lib/agency-api.js');
      await expect(first.bootstrapReauthContext()).rejects.toMatchObject({ status: 429, retryAfter: 15 });
      const saved = JSON.parse(values.get('dossiercle:bootstrap-cooldown:v1') ?? 'null') as Record<string, unknown>;
      expect(saved).toEqual({ blockedUntil: 0, bootstrapBlockedUntil: 115_000 });
      const afterReloadFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ csrfNonce: 'c'.repeat(43) }), { status: 200 })); vi.stubGlobal('fetch', afterReloadFetch);
      vi.resetModules(); const afterReload = await import('../src/lib/agency-api.js');
      await expect(afterReload.bootstrapReauthContext()).rejects.toMatchObject({ message: 'REQUEST_PAUSED' }); expect(afterReloadFetch).not.toHaveBeenCalled();
      const remaining = afterReload.bootstrapRetryDelay(); expect(remaining).toBeGreaterThan(0); expect(remaining).toBeLessThanOrEqual(600_000);
      await vi.advanceTimersByTimeAsync(remaining); expect(afterReload.bootstrapRetryDelay()).toBe(0);
      values.set('dossiercle:bootstrap-cooldown:v1', '{"blockedUntil":"invalid","bootstrapBlockedUntil":0}');
      vi.setSystemTime(200_000); vi.resetModules(); const malformed = await import('../src/lib/agency-api.js');
      await expect(malformed.bootstrapReauthContext()).rejects.toMatchObject({ message: 'REQUEST_PAUSED' });
      expect(malformed.bootstrapRetryDelay()).toBe(60_000);
      const malformedRemaining = malformed.bootstrapRetryDelay(); expect(malformedRemaining).toBe(60_000);
      await vi.advanceTimersByTimeAsync(malformedRemaining); expect(malformed.bootstrapRetryDelay()).toBe(0);
      await expect(malformed.bootstrapReauthContext()).resolves.toEqual({ csrfNonce: 'c'.repeat(43) });
      expect(afterReloadFetch).toHaveBeenCalledOnce();
    } finally { vi.resetModules(); vi.unstubAllGlobals(); vi.useRealTimers(); }
  });
  it('roundtrips exact persisted cooldown deadlines and keeps T05 separate from bootstrap reauthentication', async () => {
    vi.useFakeTimers(); vi.setSystemTime(100_000);
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    vi.stubGlobal('window', { sessionStorage: storage });
    try {
      const cases = [
        { value: { blockedUntil: 0, bootstrapBlockedUntil: 0 }, expected: [0, 0] },
        { value: { blockedUntil: 90_000, bootstrapBlockedUntil: 80_000 }, expected: [0, 0] },
        { value: { blockedUntil: 112_345, bootstrapBlockedUntil: 128_765 }, expected: [12_345, 28_765] },
      ] as const;
      for (const [index, item] of cases.entries()) {
        values.set('dossiercle:bootstrap-cooldown:v1', JSON.stringify(item.value)); vi.resetModules();
        const loaded = await import('../src/lib/agency-api.js');
        expect([loaded.retryDelay(), loaded.bootstrapRetryDelay()], `persisted deadline case ${index}`).toEqual(item.expected);
      }

      values.set('dossiercle:bootstrap-cooldown:v1', JSON.stringify({ blockedUntil: 0, bootstrapBlockedUntil: 0 }));
      const initialFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 429, headers: { 'Retry-After': '20' } })); vi.stubGlobal('fetch', initialFetch);
      vi.resetModules(); const initial = await import('../src/lib/agency-api.js');
      await expect(initial.getOnboarding()).rejects.toMatchObject({ status: 429, retryAfter: 20 });

      const reloadedFetch = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ csrfNonce: 'c'.repeat(43) }), { status: 200 }))
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
        .mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'Retry-After': '25' } }))
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ csrfNonce: 'd'.repeat(43) }), { status: 200 }));
      vi.stubGlobal('fetch', reloadedFetch); vi.resetModules(); const afterT05Reload = await import('../src/lib/agency-api.js');
      expect(afterT05Reload.retryDelay()).toBe(20_000); expect(afterT05Reload.bootstrapRetryDelay()).toBe(0);
      await expect(afterT05Reload.bootstrapReauthContext()).resolves.toEqual({ csrfNonce: 'c'.repeat(43) });
      await expect(afterT05Reload.getOnboarding()).rejects.toMatchObject({ message: 'REQUEST_PAUSED' });
      expect(reloadedFetch).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(20_000);
      expect(afterT05Reload.retryDelay()).toBe(0); await expect(afterT05Reload.getOnboarding()).resolves.toBeNull();

      await expect(afterT05Reload.bootstrapReauthContext()).rejects.toMatchObject({ status: 429, retryAfter: 25 });
      vi.resetModules(); const afterBootstrapReload = await import('../src/lib/agency-api.js');
      expect(afterBootstrapReload.retryDelay()).toBe(0); expect(afterBootstrapReload.bootstrapRetryDelay()).toBe(25_000);
      await expect(afterBootstrapReload.getOnboarding()).resolves.toBeNull();
      await expect(afterBootstrapReload.bootstrapReauthContext()).rejects.toMatchObject({ message: 'REQUEST_PAUSED' });
      expect(reloadedFetch).toHaveBeenCalledTimes(4);
      await vi.advanceTimersByTimeAsync(25_000);
      expect(afterBootstrapReload.bootstrapRetryDelay()).toBe(0);
      await expect(afterBootstrapReload.bootstrapReauthContext()).resolves.toEqual({ csrfNonce: 'd'.repeat(43) });
      expect(reloadedFetch).toHaveBeenCalledTimes(5);
    } finally { vi.resetModules(); vi.unstubAllGlobals(); vi.useRealTimers(); }
  });
  it('fails closed when same-tab quota persistence is unavailable', async () => {
    vi.stubGlobal('window', { sessionStorage: { getItem: () => null, setItem: () => { throw new Error('STORAGE_UNAVAILABLE'); } } });
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    try {
      vi.resetModules(); const api = await import('../src/lib/agency-api.js');
      expect(api.requestBudget.reserve()).toBe(false);
      await expect(api.getOnboarding()).rejects.toMatchObject({ message: 'REQUEST_BUDGET_EXHAUSTED' });
      await expect(api.bootstrapReauthContext()).rejects.toMatchObject({ message: 'REQUEST_PAUSED' });
      expect(fetcher).not.toHaveBeenCalled();
    } finally { vi.resetModules(); vi.unstubAllGlobals(); }
  });
  it('saturates a document when storage reads throw and preserves the bounded cooldown for reload', async () => {
    vi.useFakeTimers(); vi.setSystemTime(500_000);
    const values = new Map<string, string>();
    const brokenReadStorage = { getItem: (key: string) => { if (key === 'dossiercle:t05-client-quota:v1') throw new Error('READ_FAILED'); return values.get(key) ?? null; }, setItem: (key: string, value: string) => { values.set(key, value); } };
    vi.stubGlobal('window', { sessionStorage: brokenReadStorage }); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    try {
      vi.resetModules(); const first = await import('../src/lib/agency-api.js');
      expect(first.requestBudget.reserve()).toBe(false);
      await expect(first.getOnboarding()).rejects.toMatchObject({ message: 'REQUEST_BUDGET_EXHAUSTED' });
      expect(fetcher).not.toHaveBeenCalled();
      const normalStorage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
      vi.stubGlobal('window', { sessionStorage: normalStorage }); vi.resetModules(); const reloaded = await import('../src/lib/agency-api.js');
      expect(reloaded.requestBudget.reserve()).toBe(false);
      vi.setSystemTime(560_001); expect(reloaded.requestBudget.reserve()).toBe(true);
    } finally { vi.resetModules(); vi.unstubAllGlobals(); vi.useRealTimers(); }
  });
  it('keeps the caller-provided idempotency key unchanged for an explicit replay', async () => {
    const key = '0f8fad5b-d9cb-469f-a165-70867728950e';
    const response = () => new Response(JSON.stringify({ agencyId: '0f8fad5b-d9cb-469f-a165-70867728950f', operationId: key, state: 'PROVISIONING', version: '1', statusUrl: '/v1/agencies/0f8fad5b-d9cb-469f-a165-70867728950f/activation' }), { status: 202, headers: { 'Content-Type': 'application/json' } });
    const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => { void input; void init; return response(); }); vi.stubGlobal('fetch', fetcher);
    try {
      await createAgency('Espace', 'a'.repeat(43), key); await createAgency('Espace', 'a'.repeat(43), key);
      expect(fetcher.mock.calls.map(call => new Headers(call[1]?.headers).get('Idempotency-Key'))).toEqual([key, key]);
    } finally { vi.unstubAllGlobals(); }
  });
  it('sends activation only as an empty, versioned, CSRF-protected idempotent command and accepts only target ACTIVE HTTP 200', async () => {
    const target = agency.agencyId;
    const active = { agencyId: target, name: 'Espace', state: 'ACTIVE', step: 'ACTIVE', version: '3', errorCode: null, retryable: false, canActivate: false, canRetry: false, automationEnabled: false };
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    vi.stubGlobal('window', { sessionStorage: storage });
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(active), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    try {
      vi.resetModules();
      const { activateAgency } = await import('../src/lib/agency-api.js');
      await expect(activateAgency(target, 'c'.repeat(43), '0f8fad5b-d9cb-469f-a165-70867728950f', '2')).resolves.toMatchObject({ state: 'ACTIVE', agencyId: target });
      const [request, init] = fetcher.mock.calls[0] as [RequestInfo | URL, RequestInit];
      expect(String(request)).toBe(`/v1/agencies/${target}/activation`);
      const headers = new Headers(init.headers);
      expect(headers.get('X-CSRF-Token') === 'c'.repeat(43)).toBe(true);
      expect(headers.get('Idempotency-Key') === '0f8fad5b-d9cb-469f-a165-70867728950f').toBe(true);
      expect(headers.get('If-Match') === '"2"').toBe(true);
      expect(init.method).toBe('POST');
      expect(init.body).toBe('{}');
    } finally { vi.resetModules(); vi.unstubAllGlobals(); }
  });
  it.each([
    { status: 202, body: { agencyId: agency.agencyId, name: 'Espace', state: 'ACTIVE', step: 'ACTIVE', version: '3', errorCode: null, retryable: false, canActivate: false, canRetry: false, automationEnabled: false }, expected: 'REQUEST_FAILED' },
    { status: 200, body: { agencyId: agency.agencyId, name: 'Espace', state: 'READY', step: 'READY', version: '2', errorCode: null, retryable: false, canActivate: true, canRetry: false, automationEnabled: false }, expected: 'ACTIVATION_UNCONFIRMED' },
    { status: 200, body: { agencyId: '0f8fad5b-d9cb-469f-a165-70867728950f', name: 'Espace', state: 'ACTIVE', step: 'ACTIVE', version: '3', errorCode: null, retryable: false, canActivate: false, canRetry: false, automationEnabled: false }, expected: 'ACTIVATION_UNCONFIRMED' },
  ])('rejects undocumented activation result status or projection %#', async ({ status, body, expected }) => {
    const storage = { getItem: () => null, setItem: () => {} };
    vi.stubGlobal('window', { sessionStorage: storage });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
    try {
      vi.resetModules();
      const { activateAgency } = await import('../src/lib/agency-api.js');
      await expect(activateAgency(agency.agencyId, 'c'.repeat(43), '0f8fad5b-d9cb-469f-a165-70867728950f', '2')).rejects.toMatchObject({ message: expected });
    } finally { vi.resetModules(); vi.unstubAllGlobals(); }
  });
  it('honors activation Retry-After without scheduling a replay and permits only a later explicit gesture', async () => {
    vi.useFakeTimers(); vi.setSystemTime(300_000);
    const storageValues = new Map<string, string>();
    const storage = { getItem: (key: string) => storageValues.get(key) ?? null, setItem: (key: string, value: string) => { storageValues.set(key, value); } };
    vi.stubGlobal('window', { sessionStorage: storage });
    const active = { agencyId: agency.agencyId, name: 'Espace', state: 'ACTIVE', step: 'ACTIVE', version: '3', errorCode: null, retryable: false, canActivate: false, canRetry: false, automationEnabled: false };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'RATE_LIMITED', correlationId: '0f8fad5b-d9cb-469f-a165-70867728950f', retryable: true }), { status: 429, headers: { 'Retry-After': '30' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(active), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    try {
      vi.resetModules();
      const api = await import('../src/lib/agency-api.js');
      await expect(api.activateAgency(agency.agencyId, 'c'.repeat(43), '0f8fad5b-d9cb-469f-a165-70867728950f', '2')).rejects.toMatchObject({ status: 429, retryAfter: 30 });
      expect(api.retryDelay()).toBe(30_000);
      expect(fetcher).toHaveBeenCalledTimes(1);
      await expect(api.activateAgency(agency.agencyId, 'c'.repeat(43), '0f8fad5b-d9cb-469f-a165-70867728950f', '2')).rejects.toMatchObject({ message: 'REQUEST_PAUSED' });
      expect(fetcher).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(30_000);
      await expect(api.activateAgency(agency.agencyId, 'c'.repeat(43), '0f8fad5b-d9cb-469f-a165-70867728950f', '2')).resolves.toMatchObject({ state: 'ACTIVE' });
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(fetcher.mock.calls.map(call => new Headers(call[1]?.headers).get('Idempotency-Key'))).toEqual([
        '0f8fad5b-d9cb-469f-a165-70867728950f', '0f8fad5b-d9cb-469f-a165-70867728950f',
      ]);
    } finally { vi.resetModules(); vi.unstubAllGlobals(); vi.useRealTimers(); }
  });
  it.each([{ priorCalls: 5, permitted: true }, { priorCalls: 6, permitted: false }])('keeps the activation POST inside the six-call T05 budget with $priorCalls earlier calls', async ({ priorCalls, permitted }) => {
    const storage = { getItem: () => null, setItem: () => {} };
    vi.stubGlobal('window', { sessionStorage: storage });
    const active = { agencyId: agency.agencyId, name: 'Espace', state: 'ACTIVE', step: 'ACTIVE', version: '3', errorCode: null, retryable: false, canActivate: false, canRetry: false, automationEnabled: false };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(active), { status: 200 })); vi.stubGlobal('fetch', fetcher);
    try {
      vi.resetModules(); const api = await import('../src/lib/agency-api.js');
      for (let index = 0; index < priorCalls; index += 1) expect(api.requestBudget.reserve()).toBe(true);
      if (permitted) await expect(api.activateAgency(agency.agencyId, 'c'.repeat(43), '0f8fad5b-d9cb-469f-a165-70867728950f', '2')).resolves.toMatchObject({ state: 'ACTIVE' });
      else await expect(api.activateAgency(agency.agencyId, 'c'.repeat(43), '0f8fad5b-d9cb-469f-a165-70867728950f', '2')).rejects.toMatchObject({ message: 'REQUEST_BUDGET_EXHAUSTED' });
      expect(fetcher).toHaveBeenCalledTimes(permitted ? 1 : 0);
    } finally { vi.resetModules(); vi.unstubAllGlobals(); }
  });
  it.each([{ priorCalls: 5, permitted: true }, { priorCalls: 6, permitted: false }])('enforces the real T05 budget at the confirmation command boundary after $priorCalls earlier calls', async ({ priorCalls, permitted }) => {
    vi.useFakeTimers(); vi.setSystemTime(800_000);
    const values = new Map<string, string>([['dossiercle:t05-client-quota:v1', JSON.stringify({ version: 1, calls: Array.from({ length: priorCalls }, (_, index) => 800_000 - priorCalls + index), polls: [] })]]);
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    vi.stubGlobal('window', { sessionStorage: storage });
    const active = { agencyId: agency.agencyId, name: 'Espace', state: 'ACTIVE', step: 'ACTIVE', version: '3', errorCode: null, retryable: false, canActivate: false, canRetry: false, automationEnabled: false };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(active), { status: 200 })); vi.stubGlobal('fetch', fetcher);
    try {
      vi.resetModules(); const api = await import('../src/lib/agency-api.js');
      const intent: ActivationConfirmation = { agencyId: agency.agencyId, version: '2', csrfToken: session.csrfToken, idempotencyKey: '0f8fad5b-d9cb-469f-a165-70867728950f' };
      const gate = new ActivationActionGate();
      const command = runActivationCommand({ gate, intent, targetAgencyId: agency.agencyId, isCurrent: () => true,
        readCurrent: async () => ({ session, activation: { agencyId: agency.agencyId, name: 'Espace', state: 'READY', step: 'READY', version: '2', errorCode: null, retryable: false, canActivate: true, canRetry: false, automationEnabled: false } }),
        activate: (csrf, key, version) => api.activateAgency(agency.agencyId, csrf, key, version),
      });
      if (permitted) await expect(command).resolves.toMatchObject({ kind: 'activated' });
      else await expect(command).rejects.toMatchObject({ message: 'REQUEST_BUDGET_EXHAUSTED' });
      expect(fetcher).toHaveBeenCalledTimes(permitted ? 1 : 0);
      gate.release();
    } finally { vi.resetModules(); vi.unstubAllGlobals(); vi.useRealTimers(); }
  });
  it('honors an absent Retry-After globally for subsequent T05 calls', async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const fetcher = vi.fn(async () => new Response('{}', { status: 429 })); vi.stubGlobal('fetch', fetcher);
    try {
      await expect(getOnboarding()).rejects.toMatchObject({ status: 429, retryAfter: 60 });
      await expect(claim('a'.repeat(43))).rejects.toMatchObject({ status: 429 });
      await expect(getOnboarding()).rejects.toMatchObject({ message: 'REQUEST_PAUSED' });
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); vi.useRealTimers(); }
  });
  it('honors valid and malformed Retry-After values across GET and mutation requests', async () => {
    vi.useFakeTimers(); vi.setSystemTime(Date.now() + 120_000);
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'Retry-After': '45' } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'Retry-After': 'not-a-duration' } }));
    vi.stubGlobal('fetch', fetcher);
    try {
      await expect(getOnboarding()).rejects.toMatchObject({ status: 429, retryAfter: 45 });
      await expect(claim('a'.repeat(43))).rejects.toMatchObject({ message: 'REQUEST_PAUSED' });
      await expect(getOnboarding()).rejects.toMatchObject({ message: 'REQUEST_PAUSED' });
      expect(fetcher).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(45_000);
      await expect(getOnboarding()).resolves.toBeNull();
      await expect(getOnboarding()).rejects.toMatchObject({ status: 429, retryAfter: 60 });
      await expect(createAgency('Espace', 'a'.repeat(43), '0f8fad5b-d9cb-469f-a165-70867728950e')).rejects.toMatchObject({ message: 'REQUEST_PAUSED' });
      expect(fetcher).toHaveBeenCalledTimes(3);
    } finally { vi.unstubAllGlobals(); vi.useRealTimers(); }
  });
  it('validates bootstrap reauthentication schemas, exact statuses and its own Retry-After cooldown', async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfNonce: 'b'.repeat(43) }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ continueUrl: '/v1/auth/bootstrap/reauth/continue' }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfNonce: 'b'.repeat(43), extra: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'Retry-After': '25' } }));
    vi.stubGlobal('fetch', fetcher);
    try {
      await expect(bootstrapReauthContext()).resolves.toEqual({ csrfNonce: 'b'.repeat(43) });
      await expect(startBootstrapReauth('owner@example.invalid', 'b'.repeat(43))).resolves.toEqual({ continueUrl: '/v1/auth/bootstrap/reauth/continue' });
      await expect(bootstrapReauthContext()).rejects.toThrow();
      await expect(startBootstrapReauth('owner@example.invalid', 'b'.repeat(43))).rejects.toMatchObject({ status: 429, retryAfter: 25 });
      expect(bootstrapRetryDelay()).toBe(25_000);
      await expect(bootstrapReauthContext()).rejects.toMatchObject({ message: 'REQUEST_PAUSED' });
      expect(fetcher).toHaveBeenCalledTimes(4);
      await vi.advanceTimersByTimeAsync(25_000);
      expect(bootstrapRetryDelay()).toBe(0);
    } finally { vi.unstubAllGlobals(); vi.useRealTimers(); }
  });
  it('fails closed when bootstrap endpoints return a successful but undocumented status', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 })); vi.stubGlobal('fetch', fetcher);
    try { await expect(bootstrapReauthContext()).rejects.toMatchObject({ message: 'REQUEST_FAILED' }); }
    finally { vi.unstubAllGlobals(); }
  });
  it('starts polling only while visible and online; errors back off and terminal states stop', async () => {
    vi.useFakeTimers(); let value = 'PROVISIONING'; let online = true, visible = true;
    const read = vi.fn(async (signal: AbortSignal, poll: boolean) => { void signal; void poll; return { state: value }; }); const onError = vi.fn();
    let onlineListener: () => void = () => {}; let visibleListener: () => void = () => {};
    const stop = startActivationPolling({ read, onValue: () => {}, onError, online: () => online, visible: () => visible,
      addListener: (event, listener) => { if (event === 'online') onlineListener = listener; else if (event === 'visibilitychange') visibleListener = listener; },
      removeListener: (event, listener) => { if (event === 'online' && listener === onlineListener) onlineListener = () => {}; else if (event === 'visibilitychange' && listener === visibleListener) visibleListener = () => {}; },
    });
    await vi.advanceTimersByTimeAsync(20_000); expect(read).toHaveBeenCalledTimes(1);
    visible = false; visibleListener(); await vi.advanceTimersByTimeAsync(45_000); expect(read).toHaveBeenCalledTimes(1);
    visible = true; visibleListener(); await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    expect(read.mock.calls[1]?.[1]).toBe(false);
    read.mockRejectedValueOnce(Object.assign(new Error('limited'), { status: 429, retryAfter: 45 }));
    await vi.advanceTimersByTimeAsync(20_000); await vi.advanceTimersByTimeAsync(44_999); expect(read).toHaveBeenCalledTimes(3);
    expect(onError).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); expect(read).toHaveBeenCalledTimes(4);
    value = 'READY'; online = false; onlineListener(); await vi.advanceTimersByTimeAsync(100_000); expect(read).toHaveBeenCalledTimes(4);
    online = true; onlineListener(); await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(5));
    expect(read.mock.calls[4]?.[1]).toBe(false); expect(stop).toBeTypeOf('function'); stop(); vi.useRealTimers();
  });
  it('restarts after a rapid offline/online transition while resume GET is still settling', async () => {
    vi.useFakeTimers(); let online = false; const listeners = new Map<string, () => void>(); const signals: AbortSignal[] = [];
    const resolvers: Array<(value: { state: string }) => void> = [];
    const read = vi.fn((signal: AbortSignal) => { signals.push(signal); return new Promise<{ state: string }>(resolve => resolvers.push(resolve)); });
    const onValue = vi.fn();
    const stop = startActivationPolling({ read, onValue, onError: () => {}, online: () => online, visible: () => true,
      addListener: (event, listener) => { listeners.set(event, listener); }, removeListener: event => { listeners.delete(event); } });
    online = true; listeners.get('online')?.(); expect(read).toHaveBeenCalledTimes(1);
    online = false; listeners.get('offline')?.(); expect(signals[0]?.aborted).toBe(true);
    online = true; listeners.get('online')?.(); expect(read).toHaveBeenCalledTimes(2);
    resolvers[1]?.({ state: 'PROVISIONING' }); await Promise.resolve(); await Promise.resolve();
    resolvers[0]?.({ state: 'READY' }); await Promise.resolve(); await Promise.resolve();
    expect(onValue).toHaveBeenCalledOnce(); expect(onValue).toHaveBeenCalledWith({ state: 'PROVISIONING' });
    stop(); vi.useRealTimers();
  });
  it('expires polling at ten minutes including paused time and detaches listeners', async () => {
    vi.useFakeTimers(); let visible = true; const read = vi.fn(async (signal: AbortSignal, poll: boolean) => { void signal; void poll; return { state: 'PROVISIONING' }; }); const onExpired = vi.fn();
    const listeners = new Map<string, () => void>();
    const stop = startActivationPolling({ read, onValue: () => {}, onError: () => {}, visible: () => visible,
      addListener: (event, callback) => { listeners.set(event, callback); }, removeListener: event => { listeners.delete(event); }, onExpired });
    visible = false; listeners.get('visibilitychange')?.(); await vi.advanceTimersByTimeAsync(600_000); expect(onExpired).toHaveBeenCalledOnce();
    visible = true; listeners.get('visibilitychange')?.(); await vi.advanceTimersByTimeAsync(20_000); expect(read).not.toHaveBeenCalled(); expect(listeners.size).toBe(0); stop(); vi.useRealTimers();
  });
  it('exposes only the validated correlation id from normalized API errors', async () => {
    const correlationId = '0f8fad5b-d9cb-469f-a165-70867728950e';
    const error = await parseApiFailure(new Response(JSON.stringify({ code: 'DEPENDENCY_UNAVAILABLE', correlationId, retryable: true }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
    expect(error).toMatchObject({ status: 503, code: 'DEPENDENCY_UNAVAILABLE', correlationId });
    const untrusted = await parseApiFailure(new Response(JSON.stringify({ code: 'DEPENDENCY_UNAVAILABLE', correlationId, retryable: true, dsn: 'must-not-escape' }), { status: 503 }));
    expect(untrusted.status).toBe(503); expect(untrusted.message).toBe('REQUEST_FAILED'); expect(untrusted.correlationId).toBeUndefined();
  });
});

describe('creation command settlement in the initiating view', () => {
  const accepted = { agencyId: '0f8fad5b-d9cb-469f-a165-70867728950e', operationId: '0f8fad5b-d9cb-469f-a165-70867728950f', state: 'PROVISIONING' as const, version: '1', statusUrl: '/v1/agencies/0f8fad5b-d9cb-469f-a165-70867728950e/activation' };
  const command = { name: 'Espace courant', csrfToken: 'a'.repeat(43), key: '0f8fad5b-d9cb-469f-a165-708677289501' };
  it.each(['accepted', 'rejected'] as const)('ignores a late %s creation after navigation replaces its view', async outcome => {
    let resolve!: (value: typeof accepted) => void; let reject!: (error: unknown) => void;
    const response = new Promise<typeof accepted>((yes, no) => { resolve = yes; reject = no; });
    const create = vi.fn(() => response);
    let generation = 1; const initiatingGeneration = generation;
    const onAccepted = vi.fn(); const onRejected = vi.fn(); const onSettled = vi.fn();
    const pending = submitAgencyCreation(command, { isCurrent: () => generation === initiatingGeneration, onAccepted, onRejected, onSettled }, create);
    expect(create).toHaveBeenCalledExactlyOnceWith(command.name, command.csrfToken, command.key);
    ++generation; // The page cleanup or a newer context invalidates this command.
    if (outcome === 'accepted') resolve(accepted); else reject({ status: 401 });
    await pending;
    expect(onAccepted).not.toHaveBeenCalled(); expect(onRejected).not.toHaveBeenCalled(); expect(onSettled).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1); // Settlement never replays a mutation.
  });
  it.each(['accepted', 'rejected'] as const)('settles a current %s command and clears busy before leaving or invalidating the view', async outcome => {
    let resolve!: (value: typeof accepted) => void; let reject!: (error: unknown) => void;
    const response = new Promise<typeof accepted>((yes, no) => { resolve = yes; reject = no; });
    const create = vi.fn(() => response); const events: string[] = [];
    let generation = 1; const initiatingGeneration = generation;
    const onAccepted = vi.fn((value: AcceptedAgency) => { expect(value).toBe(accepted); events.push('navigate'); ++generation; });
    const failure = { status: 401 };
    const onRejected = vi.fn((error: unknown) => { expect(error).toBe(failure); events.push('expired'); ++generation; });
    const pending = submitAgencyCreation(command, { isCurrent: () => generation === initiatingGeneration, onAccepted, onRejected, onSettled: () => events.push('busy=false') }, create);
    expect(events).toEqual([]);
    if (outcome === 'accepted') resolve(accepted); else reject(failure);
    await pending;
    expect(events).toEqual(['busy=false', outcome === 'accepted' ? 'navigate' : 'expired']);
    expect(onAccepted).toHaveBeenCalledTimes(outcome === 'accepted' ? 1 : 0);
    expect(onRejected).toHaveBeenCalledTimes(outcome === 'rejected' ? 1 : 0);
    expect(create).toHaveBeenCalledExactlyOnceWith(command.name, command.csrfToken, command.key);
  });
});
