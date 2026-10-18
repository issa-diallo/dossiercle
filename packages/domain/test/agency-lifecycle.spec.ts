import { describe, it, expect } from 'vitest';
import { canonicalAgencyName, invitationTransition, creationDecision, checkIdempotency, activationDecision, retryDecision } from '../src/agency-lifecycle.js';

describe('T05 closed lifecycle', () => {
  it('normalizes and hashes the same NFC name for every creation replay', () => {
    const first = canonicalAgencyName('  Agence e\u0301  ');
    expect(first).toEqual(canonicalAgencyName('Agence é'));
    expect(first.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(creationDecision({ canonicalNameHash: first.hash }, 'Agence é').replay).toBe(true);
    expect(() => creationDecision({ canonicalNameHash: first.hash }, 'Autre')).toThrow('CREATION_CONFLICT');
  });
  it.each(['', ' ', 'a'.repeat(121), 'A\nB', 'A\u202eB'])('rejects invalid names %j', value => {
    expect(() => canonicalAgencyName(value)).toThrow('INVALID_REQUEST');
  });
  it('starts every new resource with closed defaults', () => {
    expect(creationDecision(null, 'Agence A')).toMatchObject({ state: 'PROVISIONING', membership: 'PENDING',
      role: 'ADMIN', step: 'ACCEPTED', operation: 'PENDING', replay: false });
  });
  it('keeps REVOKED terminal, including issue/retry and replay decisions', () => {
    for (const action of ['issue', 'claim', 'expire', 'revoke'] as const) {
      expect(() => invitationTransition('REVOKED', action)).toThrow('INVITATION_UNAVAILABLE');
    }
    for (const state of ['PENDING_IDENTITY', 'ISSUED', 'EXPIRED', 'CLAIMED'] as const) {
      expect(invitationTransition(state, 'issue')).toBe('ISSUED');
      expect(invitationTransition(state, 'revoke')).toBe('REVOKED');
      expect(() => invitationTransition(state, 'issue', true)).toThrow('INVITATION_UNAVAILABLE');
    }
  });
  it('claims only live/claimed states and never expires an accepted creation', () => {
    expect(invitationTransition('ISSUED', 'claim')).toBe('CLAIMED');
    expect(invitationTransition('CLAIMED', 'claim')).toBe('CLAIMED');
    expect(invitationTransition('ISSUED', 'expire')).toBe('EXPIRED');
    expect(() => invitationTransition('CLAIMED', 'expire')).toThrow();
    expect(() => invitationTransition('EXPIRED', 'claim')).toThrow();
  });
  it('distinguishes authorized replay from a conflicting request', () => {
    expect(checkIdempotency(null, 'a')).toBe(false);
    expect(checkIdempotency('a', 'a')).toBe(true);
    expect(() => checkIdempotency('a', 'b')).toThrow('IDEMPOTENCY_CONFLICT');
  });
});

describe('T07 activation lifecycle', () => {
  const ready = { state: 'READY' as const, operationStatus: 'SUCCEEDED' as const, step: 'READY',
    adminMembership: 'PENDING' as const, activatedAt: null, proofsComplete: true, preparedAuditVerified: true };
  it('publishes only a fully proven READY agency and recognizes a consistent ACTIVE replay', () => {
    expect(activationDecision(ready)).toBe('activate');
    expect(activationDecision({ ...ready, state: 'ACTIVE', adminMembership: 'ACTIVE', activatedAt: 'now' })).toBe('already-active');
  });
  it('never treats prepared evidence as ACTIVE or allows incomplete READY', () => {
    for (const change of [{ preparedAuditVerified: false }, { proofsComplete: false }, { step: 'ACCEPTED' },
      { operationStatus: 'RUNNING' }, { adminMembership: 'ACTIVE' }]) {
      expect(() => activationDecision({ ...ready, ...change } as typeof ready)).toThrow();
    }
    expect(() => activationDecision({ ...ready, state: 'ACTIVE' })).toThrow('DEPENDENCY_UNAVAILABLE');
  });
  it('retries only certain FAILED work under an idle global gate and bounded attempts', () => {
    const retry = { state: 'FAILED' as const, operationStatus: 'FAILED' as const, retryable: true,
      attempt: 1, gateIdle: true, executionUncertain: false };
    expect(() => retryDecision(retry)).not.toThrow();
    for (const change of [{ attempt: 4 }, { gateIdle: false }, { executionUncertain: true },
      { state: 'READY' }, { retryable: false }]) expect(() => retryDecision({ ...retry, ...change } as typeof retry)).toThrow();
  });
});
