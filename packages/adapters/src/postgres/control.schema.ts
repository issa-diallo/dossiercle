import { sql } from 'drizzle-orm';
import { pgSchema, uuid, text, bigint, integer, boolean, timestamp, jsonb, primaryKey, unique, check } from 'drizzle-orm/pg-core';
const control = pgSchema('control');
const identity = pgSchema('identity');
const version = () => bigint('version', { mode: 'bigint' }).notNull().default(sql`1`);
const at = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
export const invitations = control.table('agency_invitation', {
  id: uuid('id').primaryKey(), rootId: uuid('root_id').notNull().unique(), subjectId: uuid('subject_id').notNull(),
  contact: text('contact').notNull(), ownerId: uuid('owner_id').notNull(), identityStatus: text('identity_status').notNull().default('PENDING'),
  tokenHash: text('token_hash').unique(), expiresAt: at('expires_at'), status: text('status').notNull().default('PENDING_IDENTITY'),
  version: version(), recoveryChannelRef: text('recovery_channel_ref'),
}, t => [check('invitation_status', sql`${t.status} IN ('PENDING_IDENTITY','ISSUED','CLAIMED','REVOKED','EXPIRED')`),
  check('invitation_identity', sql`${t.identityStatus} IN ('PENDING','CONFIRMED','DENIED')`), check('invitation_version', sql`${t.version}>0`)]);
export const agencies = control.table('agency', {
  id: uuid('id').primaryKey(), invitationRootId: uuid('invitation_root_id').notNull().unique('agency_creation_root_unique').references(() => invitations.rootId),
  name: text('name').notNull(), canonicalNameHash: text('canonical_name_hash').notNull(), state: text('state').notNull().default('PROVISIONING'),
  version: version(), createdAt: at('created_at').notNull().defaultNow(), activatedAt: at('activated_at'), readySchemaVersion: integer('ready_schema_version'),
}, t => [check('agency_state', sql`${t.state} IN ('PROVISIONING','READY','ACTIVE','FAILED')`),
  check('agency_ready', sql`${t.state} NOT IN ('READY','ACTIVE') OR (${t.readySchemaVersion} IS NOT NULL AND ${t.readySchemaVersion}=1)`),
  check('agency_activation', sql`(${t.state}='ACTIVE') = (${t.activatedAt} IS NOT NULL)`),
  check('agency_version', sql`${t.version}>0`), check('agency_name', sql`length(${t.name}) BETWEEN 1 AND 120`)]);
export const operations = control.table('provisioning_operation', {
  id: uuid('id').primaryKey(), agencyId: uuid('agency_id').notNull().unique().references(() => agencies.id),
  step: text('step').notNull().default('ACCEPTED'), status: text('status').notNull().default('PENDING'), lastErrorCode: text('last_error_code'),
  retryable: boolean('retryable').notNull().default(false), attempt: integer('attempt').notNull().default(0), version: version(),
}, t => [check('operation_step', sql`${t.step} IN ('ACCEPTED','DATABASE_CREATED','SCHEMA_READY','SECRETS_REFERENCED','READY','ACTIVE')`),
  check('operation_status', sql`${t.status} IN ('PENDING','RUNNING','SUCCEEDED','FAILED')`), check('operation_attempt', sql`${t.attempt}>=0 AND ${t.version}>0`)]);
export const locators = control.table('database_locator', {
  agencyId: uuid('agency_id').primaryKey().references(() => agencies.id), databaseName: text('database_name').notNull().unique(),
  runtimeRole: text('runtime_role').notNull().unique(), migrationRole: text('migration_role').notNull().unique(),
  schemaVersion: integer('schema_version').notNull().default(0), secretRef: text('secret_ref').notNull().unique(), verificationVersion: bigint('verification_version', { mode: 'bigint' }).notNull().default(sql`0`),
}, t => [check('locator_versions', sql`${t.schemaVersion} IN (0,1) AND ${t.verificationVersion}>=0`)]);
export const idempotency = control.table('idempotency_record', {
  actorId: uuid('actor_id').notNull(), operationType: text('operation_type').notNull(), key: uuid('key').notNull(),
  canonicalBodyHash: text('canonical_body_hash').notNull(), resourceId: uuid('resource_id').notNull(), result: jsonb('result').notNull(),
}, t => [primaryKey({ columns: [t.actorId,t.operationType,t.key] }), check('body_hash', sql`${t.canonicalBodyHash} ~ '^[a-f0-9]{64}$'`)]);
export const authorities = identity.table('account_authority', {
  subjectId: uuid('subject_id').primaryKey(), identityEpoch: bigint('identity_epoch', { mode: 'bigint' }).notNull().default(sql`1`),
  confirmedEpoch: bigint('confirmed_epoch', { mode: 'bigint' }), status: text('status').notNull().default('PENDING'),
  journalSequence: bigint('journal_sequence', { mode: 'bigint' }).notNull().default(sql`0`), journalHash: text('journal_hash'),
  enrollmentStatus: text('enrollment_status').notNull().default('PENDING'), recoveryReady: boolean('recovery_ready').notNull().default(false),
}, t => [check('authority_status', sql`${t.status} IN ('PENDING','CONFIRMED','DENIED')`),
  check('enrollment_status', sql`${t.enrollmentStatus} IN ('PENDING','VERIFIED','DENIED')`),
  check('journal_hash', sql`${t.journalHash} IS NULL OR ${t.journalHash} ~ '^[a-f0-9]{64}$'`),
  check('authority_epoch', sql`${t.identityEpoch}>0 AND ${t.journalSequence}>=0`),
  check('authority_confirmed', sql`${t.status}<>'CONFIRMED' OR (${t.confirmedEpoch} IS NOT NULL AND ${t.confirmedEpoch}=${t.identityEpoch} AND ${t.enrollmentStatus}='VERIFIED' AND ${t.recoveryReady} AND ${t.journalSequence}>0 AND ${t.journalHash} IS NOT NULL)`)]);
export const memberships = identity.table('membership', {
  subjectId: uuid('subject_id').notNull().references(() => authorities.subjectId), agencyId: uuid('agency_id').notNull().references(() => agencies.id),
  role: text('role').notNull(), state: text('state').notNull().default('PENDING'), version: version(),
}, t => [primaryKey({ columns: [t.subjectId,t.agencyId] }), check('membership_role', sql`${t.role} IN ('ADMIN','HABILITED','STANDARD')`),
  check('membership_state', sql`${t.state} IN ('PENDING','ACTIVE','DENIED')`), check('membership_version', sql`${t.version}>0`)]);
export const sessions = identity.table('session', {
  cookieHash: text('cookie_hash').primaryKey(), subjectId: uuid('subject_id').notNull().references(() => authorities.subjectId),
  scope: text('scope').notNull(), invitationRootId: uuid('invitation_root_id').references(() => invitations.rootId), agencyId: uuid('agency_id').references(() => agencies.id),
  issuedAt: at('issued_at').notNull(), lastHumanActivityAt: at('last_human_activity_at').notNull(), absoluteExpiresAt: at('absolute_expires_at').notNull(),
  epoch: bigint('epoch', { mode: 'bigint' }).notNull(), revokedAt: at('revoked_at'), encryptedOidcTokens: text('encrypted_oidc_tokens').notNull(),
}, t => [check('session_scope', sql`${t.scope} IN ('onboarding','agency','platform')`),
  check('session_bounds', sql`${t.epoch}>0 AND ${t.absoluteExpiresAt}>${t.issuedAt} AND ${t.absoluteExpiresAt}<=${t.issuedAt}+INTERVAL '15 days' AND ${t.lastHumanActivityAt}>=${t.issuedAt}`),
  check('session_root', sql`${t.scope}<>'onboarding' OR ${t.invitationRootId} IS NOT NULL`),
  check('session_agency', sql`(${t.scope}='agency') = (${t.agencyId} IS NOT NULL)`), check('cookie_hash', sql`${t.cookieHash} ~ '^[a-f0-9]{64}$'`)]);
export const audit = control.table('audit_event', {
  eventId: uuid('event_id').primaryKey(), agencyId: uuid('agency_id').references(() => agencies.id), actorId: uuid('actor_id').notNull(), actorType: text('actor_type').notNull(),
  at: at('at').notNull().defaultNow(), eventType: text('event_type').notNull(), schemaVersion: integer('schema_version').notNull().default(1), resourceId: uuid('resource_id').notNull(),
  outcome: text('outcome').notNull(), correlation: uuid('correlation').notNull(), resourceVersion: bigint('resource_version', { mode: 'bigint' }).notNull(),
}, t => [check('audit_version', sql`${t.schemaVersion}=1 AND ${t.resourceVersion}>0`)]);
export const outbox = control.table('outbox', {
  eventId: uuid('event_id').primaryKey().references(() => audit.eventId), type: text('type').notNull(), schemaVersion: integer('schema_version').notNull().default(1),
  agencyId: uuid('agency_id').references(() => agencies.id), resourceId: uuid('resource_id').notNull(), version: version(), status: text('status').notNull().default('PENDING'), attempt: integer('attempt').notNull().default(0),
}, t => [unique('outbox_resource_version').on(t.type,t.resourceId,t.version), check('outbox_status', sql`${t.status} IN ('PENDING','DELIVERED')`), check('outbox_version', sql`${t.schemaVersion}=1 AND ${t.version}>0 AND ${t.attempt}>=0`)]);
