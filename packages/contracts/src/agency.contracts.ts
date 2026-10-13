import { z } from 'zod';

export const UUID = z.uuid();
export const AgencyState = z.enum(['PROVISIONING', 'READY', 'ACTIVE', 'FAILED']);
export const ProvisioningStep = z.enum([
  'ACCEPTED', 'DATABASE_CREATED', 'SCHEMA_READY', 'SECRETS_REFERENCED', 'READY', 'ACTIVE',
]);
export const InvitationStatus = z.enum([
  'PENDING_IDENTITY', 'ISSUED', 'CLAIMED', 'EXPIRED', 'REVOKED',
]);
export const ErrorCode = z.enum([
  'INVALID_REQUEST', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND',
  'INVITATION_UNAVAILABLE', 'IDENTITY_NOT_READY', 'DEPENDENCY_UNAVAILABLE',
  'PROVISIONING_FAILED', 'PROVISIONING_CONFLICT', 'NOT_READY',
  'IDEMPOTENCY_CONFLICT', 'CREATION_CONFLICT', 'VERSION_CONFLICT', 'RATE_LIMITED',
]);

export const Name = z.string().transform(value => value.normalize('NFC').trim())
  .refine(value => Array.from(value).length >= 1 && Array.from(value).length <= 120)
  .refine(value => !/[\p{Cc}\p{Cf}]/u.test(value));
export const Email = z.email().max(254).transform(value => {
  const separator = value.lastIndexOf('@');
  return value.slice(0, separator) + '@' + value.slice(separator + 1).toLowerCase();
});
export const EmptyBody = z.strictObject({});
export const CreateAgency = z.strictObject({ name: Name });
export const CreateInvitation = z.strictObject({
  email: Email, identityConfirmationRef: UUID, recoveryChannelRef: UUID,
});
export const ClaimInvitation = z.strictObject({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });
export const IdempotencyKey = UUID;
// Strong ETag containing an unsigned version; weak tags and lists are rejected.
export const IfMatch = z.string().regex(/^"(?:0|[1-9][0-9]{0,15})"$/)
  .transform(value => BigInt(value.slice(1, -1)));
export const Version = z.string().regex(/^(?:0|[1-9][0-9]*)$/);
export const ErrorResponse = z.strictObject({
  code: ErrorCode, correlationId: UUID, retryable: z.boolean(),
});
export const InvitationAccepted = z.strictObject({
  invitationId: UUID, status: z.literal('PENDING_IDENTITY'),
});
export const InvitationView = z.strictObject({
  invitationId: UUID, status: InvitationStatus, version: Version,
});
export const InvitationIssued = InvitationView.extend({ enrollmentUrl: z.url().startsWith('https://').optional() });
export const AgencyAccepted = z.strictObject({
  agencyId: UUID, operationId: UUID, state: AgencyState, version: Version,
  statusUrl: z.string().regex(/^\/v1\/agencies\/[0-9a-f-]+\/activation$/),
});
export const ActivationView = z.strictObject({
  agencyId: UUID, name: z.string(), state: AgencyState, step: ProvisioningStep,
  version: Version, errorCode: ErrorCode.nullable(), retryable: z.boolean(),
  canActivate: z.boolean(), canRetry: z.boolean(), automationEnabled: z.literal(false),
});
export const SessionView = z.strictObject({
  scope: z.enum(['onboarding', 'agency', 'platform']),
  agencyId: UUID.nullable(), csrfToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  idleExpiresAt: z.iso.datetime(), absoluteExpiresAt: z.iso.datetime(),
});

export type Activation = z.infer<typeof ActivationView>;
export type AcceptedAgency = z.infer<typeof AgencyAccepted>;
export type Session = z.infer<typeof SessionView>;
export type ApiErrorCode = z.infer<typeof ErrorCode>;
