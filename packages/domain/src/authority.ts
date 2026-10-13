export interface AuthorityProjection {
  subjectId: string; identityEpoch: bigint; confirmedEpoch: bigint | null; status: string;
  journalSequence: bigint; journalHash: string | null; enrollmentStatus: string; recoveryReady: boolean;
}
export interface AuthorityHead { subjectId: string; epoch: bigint; sequence: bigint; hash: string; state: 'PENDING' | 'DENIED' | 'CONFIRMED' }
export class AuthorityClosed extends Error {
  constructor(public readonly code: 'AUTHORITY_DENIED' | 'AUTHORITY_UNAVAILABLE') { super(code); }
}
/** No cached head can replace the caller's current, lock-protected journal read. */
export function requireAuthority(projection: AuthorityProjection, head: AuthorityHead | null): void {
  if (!head) throw new AuthorityClosed('AUTHORITY_UNAVAILABLE');
  if (head.subjectId!==projection.subjectId || head.epoch!==projection.identityEpoch || head.sequence!==projection.journalSequence || head.hash!==projection.journalHash) throw new AuthorityClosed('AUTHORITY_UNAVAILABLE');
  if (head.state!=='CONFIRMED' || projection.status!=='CONFIRMED' || projection.confirmedEpoch!==projection.identityEpoch || projection.enrollmentStatus!=='VERIFIED' || !projection.recoveryReady) throw new AuthorityClosed('AUTHORITY_DENIED');
}
