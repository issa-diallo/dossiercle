import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { Email, UUID } from '@dossiercle/contracts';

export const OWNER_PROOF_TTL = 24 * 60 * 60_000;
export const OWNER_PROOF_OPERATIONS = { identity: 'platform.owner-confirmation.v1',
  channel: 'platform.owner-channel.v1', binding: 'platform.owner-binding.v1' } as const;
export class OwnerProofClosed extends Error { constructor() { super('IDENTITY_NOT_READY'); } }
export interface OwnerProof {
  version: 1; ownerSubject: string; identityConfirmationRef: string; recoveryChannelRef: string;
  invitationId: string; rootId: string; subjectId: string; technicalUsername: string;
  contactHash: string; confirmedAt: string; expiresAt: string;
  provenance: 'human' | 'synthetic-fixture'; fingerprint: string;
}
export type OwnerPayload = OwnerProof & { kind: 'identity' | 'channel' };
export interface OwnerBinding { version: 1; kind: 'binding'; ownerSubject: string; rootId: string;
  identityConfirmationRef: string; recoveryChannelRef: string; sequence: string; fingerprint: string }
export interface SignedOwnerRecord { payload: OwnerPayload | OwnerBinding; signature: string }
export const ownerDigest = (text: string): string => createHash('sha256').update(text).digest('hex');
export function ownerContactHash(email: string): string { return ownerDigest(Email.parse(email)); }
export function canonicalOwnerPayload(payload: OwnerPayload | OwnerBinding): string {
  return JSON.stringify(Object.fromEntries(Object.keys(payload).sort().map(key => [key, payload[key as keyof typeof payload]])));
}
const common = ['version', 'ownerSubject', 'rootId', 'identityConfirmationRef', 'recoveryChannelRef', 'fingerprint', 'kind'];
const proofFields = [...common, 'invitationId', 'subjectId', 'technicalUsername', 'contactHash', 'confirmedAt', 'expiresAt', 'provenance'];
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function exact(value: Record<string, unknown>, fields: string[]) {
  if (Object.keys(value).sort().join('\0') !== [...fields].sort().join('\0')) throw new OwnerProofClosed();
}

/** Strict parsing happens before signature verification; JSONB key order has no meaning. */
export function parseSignedOwner(value: unknown): SignedOwnerRecord {
  if (!record(value)) throw new OwnerProofClosed();
  exact(value, ['payload', 'signature']);
  if (!record(value.payload) || typeof value.signature !== 'string' || !/^[A-Za-z0-9_-]{86}$/.test(value.signature)
    || Buffer.from(value.signature, 'base64url').toString('base64url') !== value.signature) throw new OwnerProofClosed();
  const payload = value.payload;
  if (typeof payload.kind !== 'string' || !['identity', 'channel', 'binding'].includes(payload.kind)) throw new OwnerProofClosed();
  exact(payload, payload.kind === 'binding' ? [...common, 'sequence'] : proofFields);
  for (const key of ['ownerSubject', 'rootId', 'identityConfirmationRef', 'recoveryChannelRef',
    ...(payload.kind === 'binding' ? [] : ['invitationId', 'subjectId', 'technicalUsername'])]) {
    if (typeof payload[key] !== 'string' || !UUID.safeParse(payload[key]).success
      || payload[key] !== (payload[key] as string).toLowerCase()) throw new OwnerProofClosed();
  }
  if (payload.version !== 1 || typeof payload.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(payload.fingerprint)
    || payload.identityConfirmationRef === payload.recoveryChannelRef) throw new OwnerProofClosed();
  if (payload.kind === 'binding') {
    if (typeof payload.sequence !== 'string' || !/^[1-9][0-9]{0,15}$/.test(payload.sequence)) throw new OwnerProofClosed();
  } else {
    if (payload.technicalUsername !== payload.subjectId || payload.subjectId === payload.ownerSubject
      || typeof payload.contactHash !== 'string' || !/^[a-f0-9]{64}$/.test(payload.contactHash)
      || typeof payload.provenance !== 'string' || !['human', 'synthetic-fixture'].includes(payload.provenance)) throw new OwnerProofClosed();
    for (const key of ['confirmedAt', 'expiresAt']) {
      const value = payload[key];
      if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)
        || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw new OwnerProofClosed();
    }
    if (Date.parse(payload.expiresAt as string) - Date.parse(payload.confirmedAt as string) !== OWNER_PROOF_TTL) throw new OwnerProofClosed();
  }
  return value as unknown as SignedOwnerRecord;
}

/** Used only by the host owner procedure; the runtime receives no private material. */
export function signOwnerPayload(payload: OwnerPayload | OwnerBinding, privatePem: string | Buffer): SignedOwnerRecord {
  const key = createPrivateKey(privatePem);
  if (key.asymmetricKeyType !== 'ed25519') throw new OwnerProofClosed();
  const signature = sign(null, Buffer.from(canonicalOwnerPayload(payload)), key).toString('base64url');
  return parseSignedOwner({ payload, signature });
}

export class OwnerProofVerifier {
  private readonly key;
  constructor(private readonly options: { publicPem: string | Buffer; fingerprint: string; ownerSubject: string;
    syntheticOnly: boolean; now?: () => Date }) {
    this.key = createPublicKey(options.publicPem);
    if (this.key.asymmetricKeyType !== 'ed25519' || createHash('sha256').update(this.key.export({ type: 'spki', format: 'der' })).digest('hex') !== options.fingerprint
      || !UUID.safeParse(options.ownerSubject).success) throw new OwnerProofClosed();
  }
  verify(value: unknown): SignedOwnerRecord {
    const signed = parseSignedOwner(value), payload = signed.payload;
    if (payload.ownerSubject !== this.options.ownerSubject || payload.fingerprint !== this.options.fingerprint
      || !verify(null, Buffer.from(canonicalOwnerPayload(payload)), this.key, Buffer.from(signed.signature, 'base64url'))) throw new OwnerProofClosed();
    if (payload.kind !== 'binding') {
      const now = (this.options.now?.() ?? new Date()).getTime();
      if (Date.parse(payload.confirmedAt) > now || Date.parse(payload.expiresAt) <= now
        || (payload.provenance === 'synthetic-fixture' && !this.options.syntheticOnly)) throw new OwnerProofClosed();
    }
    return signed;
  }
}
