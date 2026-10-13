import { describe, expect, it } from 'vitest';
import {
  CreateAgency, CreateInvitation, EmptyBody, IfMatch, IdempotencyKey,
  ActivationView, ErrorResponse,
} from '../src/agency.contracts.js';

const id = '00000000-0000-4000-8000-000000000001';

describe('strict S01 inputs', () => {
  it('normalizes NFC and preserves a valid agency name', () => {
    expect(CreateAgency.parse({ name: '  Agence e\u0301  ' })).toEqual({ name: 'Agence é' });
  });
  it.each(['', ' ', 'a'.repeat(121), 'Agence\nA', 'Agence\u0000A', 'Agence\u202eA'])(
    'refuses invalid name %j', name => expect(CreateAgency.safeParse({ name }).success).toBe(false),
  );
  it('counts Unicode code points rather than UTF16 units', () => {
    expect(CreateAgency.parse({ name: '🏠'.repeat(120) }).name).toHaveLength(240);
  });
  it('rejects client authority and infrastructure fields', () => {
    for (const field of ['role', 'subjectId', 'invitationId', 'databaseName', 'automationEnabled']) {
      expect(CreateAgency.safeParse({ name: 'Agence A', [field]: 'forged' }).success).toBe(false);
    }
    expect(EmptyBody.safeParse({ grant: true }).success).toBe(false);
  });
  it('preserves local email casing and requires server proof references', () => {
    expect(CreateInvitation.parse({ email: 'Local@EXAMPLE.INVALID', identityConfirmationRef: id, recoveryChannelRef: id }).email)
      .toBe('Local@example.invalid');
    expect(CreateInvitation.safeParse({ email: 'local@example.invalid', identityConfirmationRef: 'https://proof.invalid', recoveryChannelRef: id }).success).toBe(false);
  });
  it('requires UUID idempotency keys and strong integral versions', () => {
    expect(IdempotencyKey.parse(id)).toBe(id);
    expect(IfMatch.parse('"12"')).toBe(12n);
    for (const tag of ['12', 'W/"12"', '"-1"', '"1.5"', '"01"', '"1", "2"']) {
      expect(IfMatch.safeParse(tag).success).toBe(false);
    }
  });
});

describe('safe S01 outputs', () => {
  it('forbids secret fields in errors', () => {
    const error = { code: 'DEPENDENCY_UNAVAILABLE', correlationId: id, retryable: true };
    expect(ErrorResponse.parse(error)).toEqual(error);
    expect(ErrorResponse.safeParse({ ...error, dsn: 'secret-canary' }).success).toBe(false);
  });
  it('cannot present automation as enabled', () => {
    const state = { agencyId: id, name: 'Agence A', state: 'READY', step: 'READY', version: '1', errorCode: null, retryable: false, canActivate: true, canRetry: false, automationEnabled: false };
    expect(ActivationView.parse(state)).toEqual(state);
    expect(ActivationView.safeParse({ ...state, automationEnabled: true }).success).toBe(false);
  });
});
