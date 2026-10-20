import type { Activation, AcceptedAgency, Session } from '@dossiercle/contracts';

export type ViewState = 'loading' | 'claim' | 'create' | 'created' | 'denied' | 'error';
export type Flow = { state: ViewState; session?: Session; agency?: AcceptedAgency; agencyId?: string; message?: string };
export function reconcile(session: Session, agency: AcceptedAgency | null): Flow {
  if (session.scope === 'agency') return session.agencyId ? { state: 'created', session, agencyId: session.agencyId } : { state: 'denied' };
  if (session.scope === 'platform') return { state: 'denied' };
  if (agency) return { state: 'created', session, agency, agencyId: agency.agencyId };
  return { state: 'claim', session };
}
export function canViewActivation(session: Session, requestedId: string, accepted?: AcceptedAgency | null): boolean {
  if (session.scope === 'agency') return session.agencyId === requestedId;
  if (session.scope === 'onboarding') return accepted?.agencyId === requestedId;
  return false;
}
export type ActivationConfirmation = { agencyId: string; version: string; csrfToken: string; idempotencyKey: string };
export class ActivationActionGate {
  private locked = false;
  acquire(): boolean {
    if (this.locked) return false;
    this.locked = true;
    return true;
  }
  release(): void { this.locked = false; }
}

export type ActivationAttemptResult =
  | { kind: 'stale' }
  | { kind: 'session-changed'; current: { session: Session; activation: Activation } }
  | { kind: 'already-active'; current: { session: Session; activation: Activation } }
  | { kind: 'changed'; current: { session: Session; activation: Activation } }
  | { kind: 'activated'; current: { session: Session; activation: Activation } };

export function runActivationCommand(input: {
  gate: ActivationActionGate;
  intent: ActivationConfirmation;
  targetAgencyId: string;
  isCurrent: () => boolean;
  onAcquired?: () => void;
  readCurrent: () => Promise<{ session: Session; activation: Activation }>;
  activate: (csrf: string, key: string, version: string) => Promise<Activation>;
}): Promise<ActivationAttemptResult> | undefined {
  if (!input.gate.acquire()) return undefined;
  input.onAcquired?.();
  return (async () => {
    const current = await input.readCurrent();
    if (!input.isCurrent()) return { kind: 'stale' };
    if (current.session.csrfToken !== input.intent.csrfToken) return { kind: 'session-changed', current };
    if (activationIsConfirmed(current.activation, input.targetAgencyId)) return { kind: 'already-active', current };
    if (!confirmationMatches(current.activation, input.intent)) return { kind: 'changed', current };
    const activated = await input.activate(current.session.csrfToken, input.intent.idempotencyKey, input.intent.version);
    if (!input.isCurrent()) return { kind: 'stale' };
    if (!activationIsConfirmed(activated, input.targetAgencyId)) throw Object.assign(new Error('ACTIVATION_UNCONFIRMED'), { status: 502 });
    return { kind: 'activated', current: { session: current.session, activation: activated } };
  })();
}

export function confirmationMatches(value: Activation, confirmation: ActivationConfirmation): boolean {
  return value.agencyId === confirmation.agencyId && value.state === 'READY' && value.canActivate && value.version === confirmation.version;
}
export function activationIsConfirmed(value: Activation, agencyId: string): boolean {
  return value.agencyId === agencyId && value.state === 'ACTIVE';
}
export type RetryConfirmation = { agencyId: string; version: string; csrfToken: string; idempotencyKey: string };
export type RetryAttemptResult =
  | { kind: 'stale' }
  | { kind: 'session-changed'; current: { session: Session; activation: Activation } }
  | { kind: 'changed'; current: { session: Session; activation: Activation } }
  | { kind: 'uncertain'; current: { session: Session; activation: Activation } }
  | { kind: 'retrying'; current: { session: Session; activation: Activation }; accepted: AcceptedAgency };

export function retryIntentMustBeRetained(result: RetryAttemptResult): result is Extract<RetryAttemptResult, { kind: 'uncertain' }> {
  return result.kind === 'uncertain';
}

export function retryConfirmationMatches(value: Activation, intent: RetryConfirmation): boolean {
  return value.agencyId === intent.agencyId && value.state === 'FAILED' && value.canRetry && value.version === intent.version;
}

export function retryOfferVisible(value: Activation): boolean {
  return value.state === 'FAILED' && value.canRetry;
}

export function runRetryCommand(input: {
  gate: ActivationActionGate;
  intent: RetryConfirmation;
  targetAgencyId: string;
  isCurrent: () => boolean;
  onAcquired?: () => void;
  readCurrent: () => Promise<{ session: Session; activation: Activation }>;
  retry: (csrf: string, key: string, version: string) => Promise<AcceptedAgency>;
}): Promise<RetryAttemptResult> | undefined {
  if (!input.gate.acquire()) return undefined;
  input.onAcquired?.();
  return (async () => {
    const current = await input.readCurrent();
    if (!input.isCurrent()) return { kind: 'stale' };
    if (current.session.csrfToken !== input.intent.csrfToken) return { kind: 'session-changed', current };
    if (current.activation.agencyId !== input.targetAgencyId || !retryConfirmationMatches(current.activation, input.intent)) {
      return { kind: 'changed', current };
    }
    const accepted = await input.retry(current.session.csrfToken, input.intent.idempotencyKey, input.intent.version);
    if (!input.isCurrent()) return { kind: 'stale' };
    if (accepted.agencyId !== input.targetAgencyId || accepted.state !== 'PROVISIONING'
        || accepted.statusUrl !== `/v1/agencies/${input.targetAgencyId}/activation`) {
      throw Object.assign(new Error('RETRY_UNCONFIRMED'), { status: 502 });
    }
    const observed = await input.readCurrent();
    if (!input.isCurrent()) return { kind: 'stale' };
    if (observed.session.csrfToken !== input.intent.csrfToken) return { kind: 'session-changed', current: observed };
    if (observed.activation.agencyId === input.targetAgencyId && retryConfirmationMatches(observed.activation, input.intent)) {
      return { kind: 'uncertain', current: observed };
    }
    if (observed.activation.agencyId !== input.targetAgencyId || observed.activation.state !== 'PROVISIONING') {
      return { kind: 'changed', current: observed };
    }
    return { kind: 'retrying', current: observed, accepted };
  })();
}
export function activationOfferVisible(value: Activation): boolean {
  return value.state === 'READY' && value.canActivate;
}
export function activationCanOpenConfirmation(value: Activation, expectedVersion: string): boolean {
  return activationOfferVisible(value) && value.version === expectedVersion;
}
export function activationLabel(value: Activation): { heading: string; text: string } {
  switch (value.state) {
    case 'PROVISIONING': return { heading: 'Préparation de votre espace', text: stepLabel(value.step) };
    case 'READY': return { heading: 'Votre espace est prêt', text: value.canActivate ? 'Votre espace est prêt à être activé.' : 'Vérification en cours avant activation.' };
    case 'ACTIVE': return { heading: 'Votre espace est activé', text: 'Votre espace a été activé.' };
    case 'FAILED': return { heading: 'Préparation à vérifier', text: value.canRetry
      ? 'La préparation peut être reprise. Vous pouvez demander sa reprise.'
      : 'La préparation nécessite une vérification. Contactez le propriétaire de votre organisation.' };
  }
}
function stepLabel(step: Activation['step']): string {
  switch (step) {
    case 'ACCEPTED': return 'Votre demande a été acceptée.';
    case 'DATABASE_CREATED': return 'Votre espace est en préparation.';
    case 'SCHEMA_READY': return 'Vérification de votre espace.';
    case 'SECRETS_REFERENCED': return 'Vérification de votre espace.';
    case 'READY': return 'Préparation terminée.';
    case 'ACTIVE': return 'Votre espace a été activé.';
  }
}

type CreationCommand = { name: string; csrfToken: string; key: string };
type CreationView = {
  isCurrent: () => boolean;
  onAccepted: (accepted: AcceptedAgency) => void;
  onRejected: (error: unknown) => void;
  onSettled: () => void;
};
/** Settle the actual creation command only in the view that initiated it. */
export async function submitAgencyCreation(command: CreationCommand, view: CreationView,
  create: (name: string, csrfToken: string, key: string) => Promise<AcceptedAgency>): Promise<void> {
  const result = await create(command.name, command.csrfToken, command.key).then(
    accepted => ({ accepted, ok: true as const }),
    error => ({ error: error as unknown, ok: false as const }),
  );
  if (!view.isCurrent()) return;
  // Clear busy before callbacks may intentionally invalidate or leave this view.
  view.onSettled();
  if (result.ok) view.onAccepted(result.accepted);
  else view.onRejected(result.error);
}
