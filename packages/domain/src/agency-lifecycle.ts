import { createHash } from 'node:crypto';
import { Name, type ApiErrorCode } from '@dossiercle/contracts';

export class AgencyClosed extends Error {
  constructor(readonly code: ApiErrorCode) { super(code); }
}
export type InvitationState = 'PENDING_IDENTITY' | 'ISSUED' | 'EXPIRED' | 'CLAIMED' | 'REVOKED';
export const INITIAL_AGENCY = { state: 'PROVISIONING', role: 'ADMIN', membership: 'PENDING',
  step: 'ACCEPTED', operation: 'PENDING' } as const;

export function canonicalAgencyName(value: string): { name: string; hash: string } {
  const result = Name.safeParse(value);
  if (!result.success) throw new AgencyClosed('INVALID_REQUEST');
  return { name: result.data, hash: createHash('sha256').update(result.data).digest('hex') };
}

export function invitationTransition(state: InvitationState, action: 'issue' | 'claim' | 'expire' | 'revoke',
  active = false): InvitationState {
  if (state === 'REVOKED' || active) throw new AgencyClosed('INVITATION_UNAVAILABLE');
  if (action === 'issue') return 'ISSUED';
  if (action === 'revoke') return 'REVOKED';
  if (action === 'claim' && (state === 'ISSUED' || state === 'CLAIMED')) return 'CLAIMED';
  if (action === 'expire' && state === 'ISSUED') return 'EXPIRED';
  throw new AgencyClosed('INVITATION_UNAVAILABLE');
}

/** Call only after current root/session authorization; names never establish ownership. */
export function creationDecision(existing: { canonicalNameHash: string } | null, name: string) {
  const canonical = canonicalAgencyName(name);
  if (existing && existing.canonicalNameHash !== canonical.hash) throw new AgencyClosed('CREATION_CONFLICT');
  return { ...canonical, replay: existing !== null, ...INITIAL_AGENCY };
}

export function checkIdempotency(storedHash: string | null, currentHash: string): boolean {
  if (storedHash !== null && storedHash !== currentHash) throw new AgencyClosed('IDEMPOTENCY_CONFLICT');
  return storedHash !== null;
}
