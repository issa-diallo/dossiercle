import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { writeAudit } from '../audit/audit-writer.js';
import { activationDecision, retryDecision } from '@dossiercle/domain';

export interface ActivationSnapshot {
  agencyId: string; rootId: string; name: string; state: string; version: string; activatedAt: Date | null;
  readySchemaVersion: number | null;
  subjectId: string; role: string; membershipState: string; membershipVersion: string;
  operationId: string; step: string; operationStatus: string; operationVersion: string; attempt: number;
  retryable: boolean; errorCode: string | null; locatorName: string | null; runtimeRole: string | null;
  migrationRole: string | null; migrationSecretRef: string | null; secretRef: string | null; secretVersion: number | null;
  schemaVersion: number | null; verificationVersion: string | null; ownershipTag: string | null;
  proofCount: number; confirmedProofCount: number; uncertainExecution: boolean; gateIdle: boolean;
}

export type PreparedAudit = { eventId: string; eventType: string; version: string; correlation: string };
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
function uuidFrom(value: string): string {
  const hex = sha256(value).slice(0, 32).split('');
  hex[12] = '5'; hex[16] = ((Number.parseInt(hex[16]!, 16) & 3) | 8).toString(16);
  return `${hex.slice(0,8).join('')}-${hex.slice(8,12).join('')}-${hex.slice(12,16).join('')}-${hex.slice(16,20).join('')}-${hex.slice(20).join('')}`;
}

/** Every method runs on the caller's control_t07 transaction and requires exact row counts. */
export class ActivationRepository {
  async snapshot(client: PoolClient, agencyId: string, subjectId: string): Promise<ActivationSnapshot | null> {
    const row = (await client.query(`SELECT a.id AS "agencyId",a.invitation_root_id AS "rootId",a.name,a.state,a.ready_schema_version AS "readySchemaVersion",
      a.version::text,a.activated_at AS "activatedAt",m.subject_id AS "subjectId",m.role,m.state AS "membershipState",
      m.version::text AS "membershipVersion",o.id AS "operationId",o.step,o.status AS "operationStatus",
      o.version::text AS "operationVersion",o.attempt,o.retryable,o.last_error_code AS "errorCode",
      l.database_name AS "locatorName",l.runtime_role AS "runtimeRole",l.migration_role AS "migrationRole",
      l.migration_secret_ref AS "migrationSecretRef",l.secret_ref AS "secretRef",l.secret_version AS "secretVersion",l.schema_version AS "schemaVersion",
      l.verification_version::text AS "verificationVersion",l.ownership_tag AS "ownershipTag",
      count(e.effect_id)::int AS "proofCount",count(e.effect_id) FILTER(WHERE e.status='CONFIRMED')::int AS "confirmedProofCount",
      EXISTS(SELECT 1 FROM control.provisioning_execution x WHERE x.operation_id=o.id AND x.state IN ('RUNNING','BLOCKED')) AS "uncertainExecution",
      EXISTS(SELECT 1 FROM control.provisioning_gate g WHERE g.singleton=true AND g.state='IDLE' AND g.execution_id IS NULL) AS "gateIdle"
      FROM control.agency a JOIN identity.membership m ON m.agency_id=a.id AND m.subject_id=$2
      JOIN control.provisioning_operation o ON o.agency_id=a.id
      LEFT JOIN control.database_locator l ON l.agency_id=a.id
      LEFT JOIN control.provisioning_effect e ON e.operation_id=o.id AND e.target_version=1
        AND e.kind=ANY(ARRAY['LOCATOR_RESERVED','DATABASE_CREATED','SCHEMA_MIGRATED','RUNTIME_ACL','SECRET_PUBLISHED','AUDIT_CONFIRMED'])
      WHERE a.id=$1 GROUP BY a.id,m.subject_id,m.role,m.state,m.version,o.id,o.step,o.status,o.version,o.attempt,
        o.retryable,o.last_error_code,l.database_name,l.runtime_role,l.migration_role,l.secret_ref,l.secret_version,
        l.migration_secret_ref,l.schema_version,l.verification_version,l.ownership_tag`, [agencyId, subjectId])).rows[0] as ActivationSnapshot | undefined;
    return row ?? null;
  }

  async reserve(client: PoolClient, snapshot: ActivationSnapshot): Promise<{
    reservationId: string; operationId: string; prepared: PreparedAudit; activatedEventId: string; targetVersion: string; bindingHash: string;
  }> {
    this.assertReady(snapshot);
    const targetVersion = (BigInt(snapshot.version) + 1n).toString();
    const bindingHash = sha256(JSON.stringify([snapshot.agencyId,snapshot.rootId,snapshot.subjectId,snapshot.operationId,
      snapshot.readySchemaVersion,snapshot.locatorName,snapshot.runtimeRole,snapshot.migrationRole,snapshot.migrationSecretRef,snapshot.secretRef,snapshot.secretVersion,
      snapshot.schemaVersion,snapshot.verificationVersion,snapshot.ownershipTag]));
    const namespace = `t07.activation-prepare.v1:${snapshot.agencyId}:${targetVersion}`;
    const key = uuidFrom(namespace);
    const existing = (await client.query<{canonical_body_hash:string;resource_id:string;result:{reservationId?:string;operationId?:string;prepared?:PreparedAudit;activatedEventId?:string;targetVersion?:string;bindingHash?:string}}>(
      'SELECT canonical_body_hash,resource_id,result FROM control.idempotency_record WHERE actor_id=$1 AND operation_type=$2 AND key=$3',
      [snapshot.subjectId,namespace,key])).rows[0];
    if (existing) {
      if (existing.canonical_body_hash !== bindingHash || existing.resource_id !== snapshot.agencyId
        || existing.result.bindingHash !== bindingHash || existing.result.targetVersion !== targetVersion
        || !existing.result.prepared?.eventId || !existing.result.activatedEventId) throw new Error('ACTIVATION_RESERVATION_CONFLICT');
      return existing.result as {reservationId:string;operationId:string;prepared:PreparedAudit;activatedEventId:string;targetVersion:string;bindingHash:string};
    }
    const reservation = { reservationId:key, operationId:snapshot.operationId, prepared: { eventId: randomUUID(), eventType: 'agency.activation.prepared.v1',
      version: targetVersion, correlation: snapshot.operationId }, activatedEventId: randomUUID(), targetVersion, bindingHash };
    const inserted = await client.query(`INSERT INTO control.idempotency_record(actor_id,operation_type,key,canonical_body_hash,resource_id,result)
      VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT DO NOTHING`,
    [snapshot.subjectId,namespace,key,bindingHash,snapshot.agencyId,JSON.stringify(reservation)]);
    if (inserted.rowCount !== 1) throw new Error('ACTIVATION_RESERVATION_RACE');
    return reservation;
  }

  assertReady(snapshot: ActivationSnapshot): void {
    if (snapshot.state !== 'READY' || snapshot.operationStatus !== 'SUCCEEDED' || snapshot.step !== 'READY'
      || snapshot.membershipState !== 'PENDING' || snapshot.role !== 'ADMIN' || snapshot.proofCount !== 6
      || snapshot.confirmedProofCount !== 6 || snapshot.readySchemaVersion !== 1 || snapshot.schemaVersion !== 1
      || snapshot.verificationVersion !== String(snapshot.secretVersion) || !snapshot.ownershipTag
      || !snapshot.locatorName || !snapshot.runtimeRole || !snapshot.migrationRole || !snapshot.migrationSecretRef
      || !snapshot.secretRef || snapshot.uncertainExecution || !snapshot.gateIdle)
      throw new Error('NOT_READY');
  }

  async finalize(client: PoolClient, input: { snapshot: ActivationSnapshot; reservation: {
    reservationId:string; operationId:string; prepared: PreparedAudit; activatedEventId: string; targetVersion: string; bindingHash: string;
  }; prepared: PreparedAudit; actorId: string; idempotencyKey: string; bodyHash: string; correlation: string }): Promise<void> {
    const { snapshot, reservation } = input;
    if (input.prepared.eventId !== reservation.prepared.eventId || input.prepared.eventType !== reservation.prepared.eventType
      || input.prepared.version !== reservation.targetVersion || input.prepared.correlation !== snapshot.operationId
      || reservation.operationId!==snapshot.operationId || reservation.targetVersion!==(BigInt(snapshot.version)+1n).toString()
      || reservation.bindingHash!==sha256(JSON.stringify([snapshot.agencyId,snapshot.rootId,snapshot.subjectId,snapshot.operationId,
        snapshot.readySchemaVersion,snapshot.locatorName,snapshot.runtimeRole,snapshot.migrationRole,snapshot.migrationSecretRef,snapshot.secretRef,snapshot.secretVersion,
        snapshot.schemaVersion,snapshot.verificationVersion,snapshot.ownershipTag])))
      throw new Error('ACTIVATION_PREPARED_AUDIT_DIVERGED');
    activationDecision({ state: snapshot.state as 'READY'|'ACTIVE'|'FAILED'|'PROVISIONING',
      operationStatus: snapshot.operationStatus as 'PENDING'|'RUNNING'|'SUCCEEDED'|'FAILED', step: snapshot.step,
      adminMembership: snapshot.membershipState as 'PENDING'|'ACTIVE'|'DENIED',
      activatedAt: snapshot.activatedAt?.toISOString() ?? null, proofsComplete: snapshot.proofCount === 6 && snapshot.confirmedProofCount === 6,
      preparedAuditVerified: true });
    const member = await client.query(`UPDATE identity.membership SET state='ACTIVE',version=version+1
      WHERE subject_id=$1 AND agency_id=$2 AND role='ADMIN' AND state='PENDING' AND version=$3`,
    [snapshot.subjectId,snapshot.agencyId,snapshot.membershipVersion]);
    const agency = await client.query(`UPDATE control.agency SET state='ACTIVE',activated_at=clock_timestamp(),version=version+1
      WHERE id=$1 AND state='READY' AND activated_at IS NULL AND version=$2`, [snapshot.agencyId,snapshot.version]);
    const operation = await client.query(`UPDATE control.provisioning_operation SET step='ACTIVE',status='SUCCEEDED',retryable=false,version=version+1
      WHERE id=$1 AND status='SUCCEEDED' AND step='READY' AND version=$2`, [snapshot.operationId,snapshot.operationVersion]);
    if (member.rowCount !== 1 || agency.rowCount !== 1 || operation.rowCount !== 1) throw new Error('ACTIVATION_FINALIZE_RACE');
    await writeAudit(client,{eventId:reservation.activatedEventId,agencyId:snapshot.agencyId,actorId:input.actorId,
      actorType:'human',eventType:'agency.activated.v1',resourceId:snapshot.agencyId,version:BigInt(reservation.targetVersion),
      outcome:'succeeded',correlation:input.correlation,dispatch:true},'control_audit');
    const recorded = await client.query(`INSERT INTO control.idempotency_record(actor_id,operation_type,key,canonical_body_hash,resource_id,result)
      VALUES($1,'t07.agency-activation.v1',$2,$3,$4,$5::jsonb) ON CONFLICT DO NOTHING`,
    [input.actorId,input.idempotencyKey,input.bodyHash,snapshot.agencyId,JSON.stringify({agencyId:snapshot.agencyId,eventId:reservation.activatedEventId,version:reservation.targetVersion})]);
    if (recorded.rowCount !== 1) throw new Error('ACTIVATION_IDEMPOTENCY_RACE');
  }

  async retry(client: PoolClient, input: { snapshot: ActivationSnapshot; actorId: string; key: string; bodyHash: string;
    expectedVersion: bigint; correlation: string }): Promise<void> {
    const s = input.snapshot;
    retryDecision({ state:s.state as 'READY'|'ACTIVE'|'FAILED'|'PROVISIONING', operationStatus:s.operationStatus as 'PENDING'|'RUNNING'|'SUCCEEDED'|'FAILED',
      retryable:s.retryable,attempt:s.attempt,gateIdle:s.gateIdle,executionUncertain:s.uncertainExecution });
    if (BigInt(s.version) !== input.expectedVersion || s.membershipState !== 'PENDING' || s.role !== 'ADMIN') throw new Error('VERSION_CONFLICT');
    const agency = await client.query(`UPDATE control.agency SET state='PROVISIONING',version=version+1 WHERE id=$1 AND state='FAILED' AND version=$2`, [s.agencyId,s.version]);
    const operation = await client.query(`UPDATE control.provisioning_operation SET status='PENDING',last_error_code=NULL,retryable=false,version=version+1
      WHERE id=$1 AND status='FAILED' AND retryable=true AND attempt=$2 AND version=$3`, [s.operationId,s.attempt,s.operationVersion]);
    if (agency.rowCount !== 1 || operation.rowCount !== 1) throw new Error('PROVISIONING_RETRY_RACE');
    await writeAudit(client,{eventId:randomUUID(),agencyId:s.agencyId,actorId:input.actorId,actorType:'human',
      eventType:'agency.provisioning.retried.v1',resourceId:s.operationId,version:BigInt(s.operationVersion)+1n,
      outcome:'accepted',correlation:input.correlation,dispatch:false},'control_audit');
    const idem = await client.query(`INSERT INTO control.idempotency_record(actor_id,operation_type,key,canonical_body_hash,resource_id,result)
      VALUES($1,'t07.provisioning-retry.v1',$2,$3,$4,$5::jsonb) ON CONFLICT DO NOTHING`,
    [input.actorId,input.key,input.bodyHash,s.agencyId,JSON.stringify({agencyId:s.agencyId,operationId:s.operationId})]);
    if (idem.rowCount !== 1) throw new Error('RETRY_IDEMPOTENCY_RACE');
  }
}
