import { ActivationView, AgencyAccepted, BootstrapReauthContext, BootstrapReauthStarted, ClaimContext, ErrorResponse, IdempotencyKey, SessionView, UUID, Version, type Activation, type AcceptedAgency, type Session } from '@dossiercle/contracts';

export type ApiFailure = Error & { status?: number; retryAfter?: number; code?: string; correlationId?: string };
const quotaStorageKey = 'dossiercle:t05-client-quota:v1';
const cooldownStorageKey = 'dossiercle:bootstrap-cooldown:v1';
type QuotaState = { version: 1; calls: number[]; polls: number[] };
function sessionStore(): Pick<Storage, 'getItem' | 'setItem'> | undefined {
  try { return typeof window === 'undefined' ? undefined : window.sessionStorage; } catch { return undefined; }
}
export class RequestBudget {
  private readonly calls: number[] = [];
  private readonly polls: number[] = [];
  private persistenceUnavailable = false;
  constructor(private readonly now: () => number = Date.now, private readonly storage = sessionStore()) {
    if (!storage) {
      if (typeof window !== 'undefined') { this.persistenceUnavailable = true; this.saturate(); }
      return;
    }
    let raw: string | null;
    try { raw = storage.getItem(quotaStorageKey); }
    catch { this.saturate(); this.persist(); this.persistenceUnavailable = true; return; }
    if (!raw) return;
    try {
      const value: unknown = JSON.parse(raw);
      if (!isQuotaState(value, this.now())) throw new Error('INVALID_QUOTA_STATE');
      this.calls.push(...value.calls); this.polls.push(...value.polls);
      this.prune();
    } catch {
      this.saturate();
      if (!this.persist()) this.persistenceUnavailable = true;
    }
  }
  reserve(poll = false): boolean {
    if (this.persistenceUnavailable) return false;
    this.prune();
    if (this.calls.length >= 6 || (poll && this.polls.length >= 3)) return false;
    const at = this.now(); this.calls.push(at); if (poll) this.polls.push(at);
    if (!this.persist()) { this.persistenceUnavailable = true; this.saturate(); return false; }
    return true;
  }
  get remaining(): number { this.reserveCleanup(); return 6 - this.calls.length; }
  private reserveCleanup() { this.prune(); this.persist(); }
  private prune() {
    const cut = this.now() - 60_000;
    while (this.calls[0] !== undefined && this.calls[0] <= cut) this.calls.shift();
    while (this.polls[0] !== undefined && this.polls[0] <= cut) this.polls.shift();
  }
  private persist(): boolean {
    if (!this.storage) return typeof window === 'undefined';
    try { this.storage.setItem(quotaStorageKey, JSON.stringify({ version: 1, calls: this.calls, polls: this.polls } satisfies QuotaState)); return true; } catch { return false; }
  }
  private saturate() {
    const at = this.now(); this.calls.splice(0, this.calls.length, ...Array.from({ length: 6 }, () => at));
    this.polls.splice(0, this.polls.length, ...Array.from({ length: 3 }, () => at));
  }
}
function isQuotaState(value: unknown, now: number): value is QuotaState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return Object.keys(row).sort().join(',') === 'calls,polls,version' && row.version === 1
    && Array.isArray(row.calls) && row.calls.length <= 6 && row.calls.every((item, index) => typeof item === 'number' && Number.isSafeInteger(item) && item <= now && (index === 0 || item >= (row.calls as number[])[index - 1]!))
    && Array.isArray(row.polls) && row.polls.length <= 3 && row.polls.every((item, index) => typeof item === 'number' && Number.isSafeInteger(item) && item <= now && (index === 0 || item >= (row.polls as number[])[index - 1]!))
    && row.polls.every(item => (row.calls as number[]).includes(item));
}

export const requestBudget = new RequestBudget();
let cooldownPersistenceUnavailable = false;
function readBootstrapCooldown(): { blockedUntil: number; bootstrapBlockedUntil: number } {
  const now = Date.now();
  const storage = sessionStore();
  if (!storage) {
    if (typeof window !== 'undefined') { cooldownPersistenceUnavailable = true; return { blockedUntil: now + 60_000, bootstrapBlockedUntil: now + 60_000 }; }
    return { blockedUntil: 0, bootstrapBlockedUntil: 0 };
  }
  let raw: string | null;
  try { raw = storage.getItem(cooldownStorageKey); }
  catch { cooldownPersistenceUnavailable = typeof window !== 'undefined'; return { blockedUntil: now + 60_000, bootstrapBlockedUntil: now + 60_000 }; }
  if (!raw) return { blockedUntil: 0, bootstrapBlockedUntil: 0 };
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_COOLDOWN_STATE');
    const row = value as Record<string, unknown>;
    if (Object.keys(row).sort().join(',') !== 'blockedUntil,bootstrapBlockedUntil' || ![row.blockedUntil, row.bootstrapBlockedUntil].every(item => Number.isSafeInteger(item) && typeof item === 'number' && item >= 0 && item <= now + 600_000)) throw new Error('INVALID_COOLDOWN_STATE');
    return { blockedUntil: Math.max(0, row.blockedUntil as number), bootstrapBlockedUntil: Math.max(0, row.bootstrapBlockedUntil as number) };
  } catch { return { blockedUntil: now + 60_000, bootstrapBlockedUntil: now + 60_000 }; }
}
let { blockedUntil, bootstrapBlockedUntil } = readBootstrapCooldown();
function persistCooldowns(): boolean {
  try {
    const storage = sessionStore();
    if (!storage) { cooldownPersistenceUnavailable = typeof window !== 'undefined'; return !cooldownPersistenceUnavailable; }
    storage.setItem(cooldownStorageKey, JSON.stringify({ blockedUntil, bootstrapBlockedUntil })); return true;
  } catch { cooldownPersistenceUnavailable = typeof window !== 'undefined'; return false; }
}
if (!persistCooldowns()) cooldownPersistenceUnavailable = true;
export function retryDelay(): number { return Math.max(0, blockedUntil - Date.now()); }
export function bootstrapRetryDelay(): number { return Math.max(0, bootstrapBlockedUntil - Date.now()); }
function reserveBootstrap(): void {
  if (cooldownPersistenceUnavailable) throw Object.assign(new Error('REQUEST_PAUSED'), { status: 429, retryAfter: 60 });
  if (Date.now() < bootstrapBlockedUntil) throw Object.assign(new Error('REQUEST_PAUSED'), { status: 429, retryAfter: Math.ceil((bootstrapBlockedUntil - Date.now()) / 1000) });
}
export async function bootstrapFailure(response: Response): Promise<ApiFailure> {
  const parsed = await parseError(response);
  let retryAfter: number | undefined;
  if (response.status === 429) {
    const value = Number(response.headers.get('Retry-After'));
    retryAfter = Number.isInteger(value) && value > 0 && value <= 600 ? value : 60;
    bootstrapBlockedUntil = Math.max(bootstrapBlockedUntil, Date.now() + retryAfter * 1000);
    if (!persistCooldowns()) cooldownPersistenceUnavailable = true;
  }
  return Object.assign(new Error(parsed.code ?? (response.status === 401 ? 'UNAUTHENTICATED' : response.status === 403 ? 'FORBIDDEN' : 'REQUEST_FAILED')), { status: response.status, ...(retryAfter === undefined ? {} : { retryAfter }), ...(parsed.code ? { code: parsed.code } : {}), ...(parsed.correlationId ? { correlationId: parsed.correlationId } : {}) });
}
export function unexpectedStatus(): ApiFailure { return Object.assign(new Error('REQUEST_FAILED'), { code: 'REQUEST_FAILED' }); }
function reserveFlux(poll = false): void {
  if (Date.now() < blockedUntil) throw Object.assign(new Error('REQUEST_PAUSED'), { status: 429, retryAfter: Math.ceil((blockedUntil - Date.now()) / 1000) });
  if (!requestBudget.reserve(poll)) throw Object.assign(new Error('REQUEST_BUDGET_EXHAUSTED'), { status: 429 });
}
function applyRetryAfter(response: Response): number {
  const value = Number(response.headers.get('Retry-After'));
  const seconds = Number.isInteger(value) && value > 0 && value <= 600 ? value : 60;
  blockedUntil = Math.max(blockedUntil, Date.now() + seconds * 1000);
  if (!persistCooldowns()) cooldownPersistenceUnavailable = true;
  return seconds;
}

async function call<T>(path: string, schema: { parse(value: unknown): T }, csrf?: string, poll = false, signal?: AbortSignal): Promise<T> {
  reserveFlux(poll);
  const headers = new Headers({ Accept: 'application/json' });
  if (csrf) { headers.set('Content-Type', 'application/json'); headers.set('X-CSRF-Token', csrf); }
  const response = await fetch(path, { method: csrf ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', headers, ...(csrf ? { body: '{}' } : {}), ...(signal ? { signal } : {}) });
  if (response.status !== 200) { if (!response.ok) throw await parseApiFailure(response); throw unexpectedStatus(); }
  return schema.parse(await response.json());
}

export async function getSession(signal?: AbortSignal): Promise<Session> {
  // /v1/session has its own authentication quota; it is not a T05 business API call.
  const response = await fetch('/v1/session', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' }, ...(signal ? { signal } : {}) });
  if (!response.ok) throw Object.assign(new Error(response.status === 401 ? 'UNAUTHENTICATED' : response.status === 403 ? 'FORBIDDEN' : 'SESSION_UNAVAILABLE'), { status: response.status });
  return SessionView.parse(await response.json());
}
export async function getOnboarding(signal?: AbortSignal): Promise<AcceptedAgency | null> {
  reserveFlux();
  const response = await fetch('/v1/onboarding/agency', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' }, ...(signal ? { signal } : {}) });
  if (response.status === 204) return null;
  if (response.status !== 200) { if (!response.ok) throw await parseApiFailure(response); throw unexpectedStatus(); }
  return AgencyAccepted.parse(await response.json());
}
export async function parseApiFailure(response: Response): Promise<ApiFailure> {
  const parsed = await parseError(response);
  const retryAfter = response.status === 429 ? applyRetryAfter(response) : undefined;
  return Object.assign(new Error(parsed.code ?? (response.status === 401 ? 'UNAUTHENTICATED' : response.status === 403 ? 'FORBIDDEN' : 'REQUEST_FAILED')), { status: response.status, ...(retryAfter === undefined ? {} : { retryAfter }), ...(parsed.code ? { code: parsed.code } : {}), ...(parsed.correlationId ? { correlationId: parsed.correlationId } : {}) });
}
async function parseError(response: Response): Promise<{ code?: string; correlationId?: string }> {
  try {
    const parsed = ErrorResponse.parse(await response.json());
    return { code: parsed.code, correlationId: parsed.correlationId };
  } catch { return {}; }
}
export async function claim(csrf: string): Promise<void> {
  reserveFlux();
  const response = await fetch('/v1/onboarding/invitation/claim', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: '{}' });
  if (response.status !== 200) { if (!response.ok) throw await parseApiFailure(response); throw unexpectedStatus(); }
  ClaimContext.parse(await response.json());
}
export async function createAgency(name: string, csrf: string, key: string): Promise<AcceptedAgency> {
  reserveFlux();
  const response = await fetch('/v1/agencies', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'Idempotency-Key': key }, body: JSON.stringify({ name }) });
  if (response.status !== 202) { if (!response.ok) throw await parseApiFailure(response); throw unexpectedStatus(); }
  return AgencyAccepted.parse(await response.json());
}
export async function bootstrapReauthContext(signal?: AbortSignal): Promise<{ csrfNonce: string }> {
  reserveBootstrap();
  const response = await fetch('/v1/auth/bootstrap/reauth/context', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' }, ...(signal ? { signal } : {}) });
  if (response.status !== 200) { if (!response.ok) throw await bootstrapFailure(response); throw unexpectedStatus(); }
  return BootstrapReauthContext.parse(await response.json());
}
export async function startBootstrapReauth(email: string, nonce: string, signal?: AbortSignal): Promise<{ continueUrl: string }> {
  reserveBootstrap();
  const response = await fetch('/v1/auth/bootstrap/reauth/start', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-S01-Bootstrap-CSRF': nonce }, body: JSON.stringify({ email }), ...(signal ? { signal } : {}) });
  if (response.status !== 202) { if (!response.ok) throw await bootstrapFailure(response); throw unexpectedStatus(); }
  return BootstrapReauthStarted.parse(await response.json());
}
export async function getActivation(id: string, signal?: AbortSignal, poll = false): Promise<Activation> {
  return call(`/v1/agencies/${encodeURIComponent(id)}/activation`, ActivationView, undefined, poll, signal);
}
export async function activateAgency(id: string, csrf: string, key: string, version: string, signal?: AbortSignal): Promise<Activation> {
  const agencyId = UUID.parse(id);
  reserveFlux();
  const idempotencyKey = IdempotencyKey.parse(key);
  const currentVersion = Version.parse(version);
  const response = await fetch(`/v1/agencies/${encodeURIComponent(agencyId)}/activation`, {
    method: 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: {
      Accept: 'application/json', 'Content-Type': 'application/json',
      'X-CSRF-Token': csrf, 'Idempotency-Key': idempotencyKey,
      'If-Match': `"${currentVersion}"`,
    }, body: '{}', ...(signal ? { signal } : {}),
  });
  if (response.status !== 200) { if (!response.ok) throw await parseApiFailure(response); throw unexpectedStatus(); }
  const result = ActivationView.parse(await response.json());
  if (result.agencyId !== agencyId || result.state !== 'ACTIVE') {
    throw Object.assign(new Error('ACTIVATION_UNCONFIRMED'), { status: 502 });
  }
  return result;
}
