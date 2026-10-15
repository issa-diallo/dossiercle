import { describe, it, expect } from 'vitest';
import { canonicalAgencyName, invitationTransition, creationDecision, checkIdempotency } from '../src/agency-lifecycle.js';

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
