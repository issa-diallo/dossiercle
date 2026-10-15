import type { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { OWNER_PROOF_OPERATIONS, OWNER_PROOF_TTL, OwnerProofClosed, canonicalOwnerPayload,
  ownerContactHash, ownerDigest, signOwnerPayload, type OwnerBinding, type OwnerPayload,
  type OwnerProof, type OwnerProofVerifier, type SignedOwnerRecord } from './owner-proof.js';

interface ProofRow { actor_id: string; operation_type: string; key: string; resource_id: string;
  canonical_body_hash: string; result: unknown }
export interface OwnerProofRefs { identityConfirmationRef: string; recoveryChannelRef: string; email: string }
function checkRow(row: ProofRow | undefined, verifier: OwnerProofVerifier): SignedOwnerRecord {
  if (!row) throw new OwnerProofClosed();
  const signed = verifier.verify(row.result), payload = signed.payload;
  const expectedKey = payload.kind === 'channel' ? payload.recoveryChannelRef : payload.identityConfirmationRef;
  if (row.actor_id !== payload.ownerSubject || row.resource_id !== payload.rootId || row.key !== expectedKey
    || row.operation_type !== OWNER_PROOF_OPERATIONS[payload.kind]
    || row.canonical_body_hash !== ownerDigest(canonicalOwnerPayload(payload))) throw new OwnerProofClosed();
  return signed;
}

export async function latestBinding(client: PoolClient, root: string, verifier: OwnerProofVerifier): Promise<OwnerBinding | null> {
  const row = (await client.query<ProofRow>(`SELECT * FROM control.idempotency_record
    WHERE operation_type=$1 AND resource_id=$2 ORDER BY (result->'payload'->>'sequence')::numeric DESC,key DESC LIMIT 1`,
  [OWNER_PROOF_OPERATIONS.binding, root])).rows[0];
  if (!row) return null;
  const value = checkRow(row, verifier).payload;
  if (value.kind !== 'binding') throw new OwnerProofClosed();
  return value;
}

export async function readCurrentOwnerConfirmation(client: PoolClient,
  invitation: {id:string;root_id:string;subject_id:string;owner_id:string;contact:string}, verifier: OwnerProofVerifier): Promise<OwnerProof> {
  const binding=await latestBinding(client,invitation.root_id,verifier);
  if(!binding)throw new OwnerProofClosed();
  const proof=await readOwnerConfirmation(client,{email:invitation.contact,
    identityConfirmationRef:binding.identityConfirmationRef,recoveryChannelRef:binding.recoveryChannelRef},verifier);
  if(proof.invitationId!==invitation.id||proof.rootId!==invitation.root_id||proof.subjectId!==invitation.subject_id||proof.ownerSubject!==invitation.owner_id)throw new OwnerProofClosed();
  return proof;
}

/** Caller re-reads under the root lock. Reading this proof never authorizes a session. */
export async function readOwnerConfirmation(client: PoolClient, refs: OwnerProofRefs, verifier: OwnerProofVerifier): Promise<OwnerProof> {
  const rows = (await client.query<ProofRow>(`SELECT * FROM control.idempotency_record WHERE
    (operation_type=$1 AND key=$2) OR (operation_type=$3 AND key=$4)`,
  [OWNER_PROOF_OPERATIONS.identity, refs.identityConfirmationRef, OWNER_PROOF_OPERATIONS.channel, refs.recoveryChannelRef])).rows;
  if (rows.length !== 2) throw new OwnerProofClosed();
  const identity = checkRow(rows.find(row => row.operation_type === OWNER_PROOF_OPERATIONS.identity), verifier).payload;
  const channel = checkRow(rows.find(row => row.operation_type === OWNER_PROOF_OPERATIONS.channel), verifier).payload;
  if (identity.kind !== 'identity' || channel.kind !== 'channel') throw new OwnerProofClosed();
  const proof = Object.fromEntries(Object.entries(identity).filter(([key]) => key !== 'kind')) as unknown as OwnerProof;
  if (canonicalOwnerPayload(identity) !== canonicalOwnerPayload({ ...channel, kind: 'identity' })) throw new OwnerProofClosed();
  if (proof.identityConfirmationRef !== refs.identityConfirmationRef || proof.recoveryChannelRef !== refs.recoveryChannelRef
    || proof.contactHash !== ownerContactHash(refs.email)) throw new OwnerProofClosed();
  const binding = await latestBinding(client, proof.rootId, verifier);
  if (!binding || binding.identityConfirmationRef !== proof.identityConfirmationRef || binding.recoveryChannelRef !== proof.recoveryChannelRef) throw new OwnerProofClosed();
  return proof;
}

/** Host procedure in an existing transaction: advisory root → invitation before any identity locks. */
export async function storeOwnerConfirmation(client: PoolClient, input: { ownerSubject: string; fingerprint: string;
  privatePem: string | Buffer; email: string; provenance: 'human' | 'synthetic-fixture'; now?: Date;
  existing?: { invitationId: string; rootId: string; subjectId: string } }, verifier: OwnerProofVerifier): Promise<OwnerProof> {
  const ids = input.existing ?? { invitationId: randomUUID(), rootId: randomUUID(), subjectId: randomUUID() };
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['t05.root:' + ids.rootId]);
  const existing = (await client.query<{ id: string; subject_id: string; owner_id: string; contact: string; status: string }>(
    'SELECT id,subject_id,owner_id,contact,status FROM control.agency_invitation WHERE root_id=$1 FOR UPDATE', [ids.rootId])).rows[0];
  if (input.existing && (!existing || existing.id !== ids.invitationId || existing.subject_id !== ids.subjectId
    || existing.owner_id !== input.ownerSubject || ownerContactHash(existing.contact) !== ownerContactHash(input.email)
    || existing.status === 'REVOKED')) throw new OwnerProofClosed();
  const previous = await latestBinding(client, ids.rootId, verifier);
  const now = input.now ?? new Date();
  const proof: OwnerProof = { version: 1, ownerSubject: input.ownerSubject, ...ids, technicalUsername: ids.subjectId,
    identityConfirmationRef: randomUUID(), recoveryChannelRef: randomUUID(), contactHash: ownerContactHash(input.email),
    confirmedAt: now.toISOString(), expiresAt: new Date(now.getTime() + OWNER_PROOF_TTL).toISOString(),
    provenance: input.provenance, fingerprint: input.fingerprint };
  const identity: OwnerPayload = { ...proof, kind: 'identity' }, channel: OwnerPayload = { ...proof, kind: 'channel' };
  const binding: OwnerBinding = { version: 1, kind: 'binding', ownerSubject: input.ownerSubject, rootId: ids.rootId,
    identityConfirmationRef: proof.identityConfirmationRef, recoveryChannelRef: proof.recoveryChannelRef,
    sequence: (BigInt(previous?.sequence ?? '0') + 1n).toString(), fingerprint: input.fingerprint };
  for (const [payload, key] of [[identity, proof.identityConfirmationRef], [channel, proof.recoveryChannelRef], [binding, proof.identityConfirmationRef]] as const) {
    const signed = signOwnerPayload(payload, input.privatePem); verifier.verify(signed);
    await client.query(`INSERT INTO control.idempotency_record(actor_id,operation_type,key,canonical_body_hash,resource_id,result)
      VALUES($1,$2,$3,$4,$5,$6)`, [input.ownerSubject, OWNER_PROOF_OPERATIONS[payload.kind], key,
      ownerDigest(canonicalOwnerPayload(payload)), proof.rootId, JSON.stringify(signed)]);
  }
  return proof;
}
