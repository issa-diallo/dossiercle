import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { OWNER_PROOF_TTL, OwnerProofVerifier, canonicalOwnerPayload, ownerContactHash, signOwnerPayload,
  type OwnerPayload } from '../src/identity/owner-proof.js';

const pair = generateKeyPairSync('ed25519');
const publicPem = pair.publicKey.export({ type: 'spki', format: 'pem' });
const privatePem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' });
const fingerprint = createHash('sha256').update(pair.publicKey.export({ type: 'spki', format: 'der' })).digest('hex');
const ownerSubject = randomUUID(), now = new Date('2026-10-15T10:00:00.000Z'), subjectId = randomUUID();
const payload: OwnerPayload = { version: 1, kind: 'identity', ownerSubject, identityConfirmationRef: randomUUID(),
  recoveryChannelRef: randomUUID(), invitationId: randomUUID(), rootId: randomUUID(), subjectId, technicalUsername: subjectId,
  contactHash: ownerContactHash('Local@EXAMPLE.INVALID'), confirmedAt: now.toISOString(),
  expiresAt: new Date(now.getTime() + OWNER_PROOF_TTL).toISOString(), provenance: 'synthetic-fixture', fingerprint };
const verifier = (options: Partial<ConstructorParameters<typeof OwnerProofVerifier>[0]> = {}) =>
  new OwnerProofVerifier({ publicPem, fingerprint, ownerSubject, syntheticOnly: true, now: () => now, ...options });

describe('private signed owner proof', () => {
  it('verifies JSONB key order independently and stores contact only as a hash', () => {
    const signed = signOwnerPayload(payload, privatePem);
    const reordered = Object.fromEntries(Object.entries(payload).reverse());
    expect(verifier().verify({ ...signed, payload: reordered }).payload).toEqual(payload);
    expect(canonicalOwnerPayload(payload)).not.toContain('Local@');
    expect(ownerContactHash('Local@example.invalid')).toBe(payload.contactHash);
    expect(ownerContactHash('local@example.invalid')).not.toBe(payload.contactHash);
  });
  it.each(Object.keys(payload))('covers every payload field with the signature: %s', field => {
    const signed = signOwnerPayload(payload, privatePem);
    expect(() => verifier().verify({ ...signed, payload: { ...payload, [field]: 'forged' } })).toThrow();
  });
  it('rejects extra envelope/payload fields and substituted keys/signatures', () => {
    const signed = signOwnerPayload(payload, privatePem);
    expect(() => verifier().verify({ ...signed, secret: 'forged' })).toThrow();
    expect(() => verifier().verify({ ...signed, payload: { ...payload, contact: 'forged' } })).toThrow();
    expect(() => verifier().verify({ ...signed, signature: 'A'.repeat(86) })).toThrow();
    expect(() => verifier({ fingerprint: '0'.repeat(64) })).toThrow();
    const other = generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' });
    expect(() => verifier().verify(signOwnerPayload(payload, other))).toThrow();
  });
  it('refuses stale/future/wrong-owner and synthetic proof outside synthetic mode', () => {
    const signed = signOwnerPayload(payload, privatePem);
    expect(() => verifier({ now: () => new Date(now.getTime() + OWNER_PROOF_TTL) }).verify(signed)).toThrow();
    expect(() => verifier({ now: () => new Date(now.getTime() - 1) }).verify(signed)).toThrow();
    expect(() => verifier({ ownerSubject: randomUUID() }).verify(signed)).toThrow();
    expect(() => verifier({ syntheticOnly: false }).verify(signed)).toThrow();
    expect(() => verifier({ syntheticOnly: false }).verify(signOwnerPayload({ ...payload, provenance: 'human' }, privatePem))).not.toThrow();
  });
  it('forbids self-target, mismatched username and unpaired refs even for a signer', () => {
    for (const extra of [{ subjectId: ownerSubject, technicalUsername: ownerSubject },
      { technicalUsername: randomUUID() }, { recoveryChannelRef: payload.identityConfirmationRef }]) {
      expect(() => signOwnerPayload({ ...payload, ...extra }, privatePem)).toThrow();
    }
  });
});
