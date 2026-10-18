import { createHash } from 'node:crypto';
import { Name, type ApiErrorCode } from '@dossiercle/contracts';

export class AgencyClosed extends Error {
  constructor(readonly code: ApiErrorCode) { super(code); }
}
export type InvitationState = 'PENDING_IDENTITY' | 'ISSUED' | 'EXPIRED' | 'CLAIMED' | 'REVOKED';
export type AgencyLifecycleState = 'PROVISIONING' | 'READY' | 'ACTIVE' | 'FAILED';
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

/** A local prepared audit is evidence for publication, never publication itself. */
export function activationDecision(input: {
  state: AgencyLifecycleState;
  operationStatus: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  step: string;
  adminMembership: 'PENDING' | 'ACTIVE' | 'DENIED';
  activatedAt: string | null;
  proofsComplete: boolean;
  preparedAuditVerified: boolean;
}): 'activate' | 'already-active' {
  if (input.state === 'ACTIVE') {
    if (input.operationStatus !== 'SUCCEEDED' || input.adminMembership !== 'ACTIVE' || input.activatedAt === null)
      throw new AgencyClosed('DEPENDENCY_UNAVAILABLE');
    return 'already-active';
  }
  if (input.state !== 'READY' || input.operationStatus !== 'SUCCEEDED' || input.step !== 'READY'
      || input.adminMembership !== 'PENDING' || input.activatedAt !== null
      || !input.proofsComplete || !input.preparedAuditVerified)
    throw new AgencyClosed('NOT_READY');
  return 'activate';
}

export function retryDecision(input: {
  state: AgencyLifecycleState;
  operationStatus: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  retryable: boolean;
  attempt: number;
  gateIdle: boolean;
  executionUncertain: boolean;
}): void {
  if (input.state !== 'FAILED' || input.operationStatus !== 'FAILED' || !input.retryable
      || input.attempt >= 4 || !input.gateIdle || input.executionUncertain)
    throw new AgencyClosed('NOT_READY');
}
