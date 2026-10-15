import type { PoolClient } from '@dossiercle/adapters/postgres/runtime-pool';
import { UUID, type ApiErrorCode } from '@dossiercle/contracts';
import type { SessionRow,SessionPrincipal } from './auth.service.js';

export class T05LockClosed extends Error {
  constructor(readonly code: ApiErrorCode) { super(code); }
}
export interface T05Target {
  rootId: string; subjectId: string;
  authority: 'existing' | 'initialize-pending' | 'optional';
  invitation: 'existing' | 'reservation';
}
export interface T05LockPlan<Decision=void> {
  mode: 'owner' | 'onboarding';
  /** Private service resolver: IDs from verified signed proofs/DB, never public request sub/root. */
  resolve(client: PoolClient): Promise<readonly T05Target[]>;
  /** Read-only business checks after current auth/native/CSRF, before the first refresh append. */
  validate?(client: PoolClient,principal:SessionPrincipal,locked:T05LockedContext):Promise<Decision>;
}
export interface T05InvitationRow {
  id: string; root_id: string; subject_id: string; owner_id: string; status: string;
  identity_status: string; version: string; token_hash: string | null; expires_at: Date | null; contact: string;
}
export interface T05AuthorityRow {
  subject_id: string; identity_epoch: string; confirmed_epoch: string | null; status: string;
  journal_sequence: string; journal_hash: string | null; enrollment_status: string; recovery_ready: boolean;
}
export interface T05LockedContext {
  readonly targets: readonly T05Target[];
  readonly invitations: ReadonlyMap<string, T05InvitationRow>;
  readonly authorities: ReadonlyMap<string, T05AuthorityRow>;
}
function normalized(targets: readonly T05Target[]): T05Target[] {
  // Empty owner resolution supports a missing-resource response after current authorization.
  if (targets.length > 4) throw new T05LockClosed('INVALID_REQUEST');
  const roots = new Set<string>();
  return [...targets].map(target => {
    if (!UUID.safeParse(target.rootId).success || !UUID.safeParse(target.subjectId).success
      || target.rootId !== target.rootId.toLowerCase() || target.subjectId !== target.subjectId.toLowerCase()
      || roots.has(target.rootId) || !['existing', 'initialize-pending', 'optional'].includes(target.authority)
      || !['existing', 'reservation'].includes(target.invitation)) throw new T05LockClosed('INVALID_REQUEST');
    roots.add(target.rootId); return { rootId: target.rootId, subjectId: target.subjectId,
      authority: target.authority, invitation: target.invitation };
  }).sort((a, b) => a.rootId.localeCompare(b.rootId));
}

/** All root/authority/session/projection locks precede the actor's first refresh/J1 append. */
export async function lockT05Subjects(client: PoolClient, candidate: SessionRow, plan: T05LockPlan<unknown>): Promise<T05LockedContext> {
  const targets = normalized(await plan.resolve(client));
  if (plan.mode === 'onboarding' && (targets.length !== 1 || targets.some(target => target.rootId !== candidate.invitation_root_id
    || target.subjectId !== candidate.subject_id || target.authority !== 'existing' || target.invitation !== 'existing'))) {
    throw new T05LockClosed('FORBIDDEN');
  }
  const roots = [...new Set([...targets.map(target => target.rootId), ...(candidate.invitation_root_id ? [candidate.invitation_root_id] : [])])].sort();
  const invitations = new Map<string, T05InvitationRow>();
  // Reservations and the host proof procedure use the same root domain and ordering.
  for (const root of roots) await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['t05.root:' + root]);
  for (const root of roots) {
    const row = (await client.query<T05InvitationRow>('SELECT * FROM control.agency_invitation WHERE root_id=$1 FOR UPDATE', [root])).rows[0];
    const target = targets.find(value => value.rootId === root);
    if (row) {
      if (target && row.subject_id !== target.subjectId) throw new T05LockClosed('INVITATION_UNAVAILABLE');
      invitations.set(root, row);
    } else if (root === candidate.invitation_root_id || target?.invitation === 'existing') throw new T05LockClosed('INVITATION_UNAVAILABLE');
  }
  for (const target of targets) if (target.authority === 'initialize-pending') {
    if (!invitations.has(target.rootId)) throw new T05LockClosed('INVITATION_UNAVAILABLE');
    await client.query('INSERT INTO identity.account_authority(subject_id) VALUES($1) ON CONFLICT DO NOTHING', [target.subjectId]);
  }
  const subjects = [...new Set([candidate.subject_id, ...targets.map(target => target.subjectId)])].sort();
  const authorities = new Map<string, T05AuthorityRow>();
  for (const subject of subjects) {
    const row = (await client.query<T05AuthorityRow>('SELECT * FROM identity.account_authority WHERE subject_id=$1 FOR UPDATE', [subject])).rows[0];
    const target = targets.find(value => value.subjectId === subject);
    if (!row && (subject === candidate.subject_id || target?.authority !== 'optional')) throw new T05LockClosed('IDENTITY_NOT_READY');
    if (row) authorities.set(subject, row);
  }
  await client.query('SELECT cookie_hash FROM identity.session WHERE subject_id=ANY($1::uuid[]) ORDER BY subject_id,cookie_hash FOR UPDATE', [subjects]);
  // Coordinator has no agency UPDATE capability, so direct FOR SHARE is forbidden by PG.
  // Existing scope definer locks agency/membership SHARE. Acquire membership UPDATE first:
  // all their subject authorities are already held; agency locks here are SHARE only.
  const agencies = (await client.query<{id:string;invitation_root_id:string}>(
    'SELECT id,invitation_root_id FROM control.agency WHERE invitation_root_id=ANY($1::uuid[]) ORDER BY id', [roots])).rows;
  await client.query('SELECT subject_id,agency_id FROM identity.membership WHERE subject_id=ANY($1::uuid[]) ORDER BY subject_id,agency_id FOR UPDATE', [subjects]);
  for (const agency of agencies) {
    const subject = invitations.get(agency.invitation_root_id)?.subject_id;
    const scope = (await client.query<{id:string}>('SELECT * FROM control.lock_session_scope($1,$2)',
      [subject, agency.invitation_root_id])).rows[0];
    if (!scope || scope.id !== agency.id) throw new T05LockClosed('IDENTITY_NOT_READY');
  }
  const current = (await client.query<SessionRow>('SELECT * FROM identity.session WHERE cookie_hash=$1 FOR UPDATE', [candidate.cookie_hash])).rows[0];
  if (!current || current.subject_id !== candidate.subject_id || current.invitation_root_id !== candidate.invitation_root_id
    || current.scope !== candidate.scope || current.agency_id !== candidate.agency_id || current.epoch !== candidate.epoch) throw new T05LockClosed('UNAUTHENTICATED');
  if (JSON.stringify(normalized(await plan.resolve(client))) !== JSON.stringify(targets)) throw new T05LockClosed('INVITATION_UNAVAILABLE');
  return { targets, invitations, authorities };
}
