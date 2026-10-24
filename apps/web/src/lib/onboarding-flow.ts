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
export function activationLabel(value: Activation): { heading: string; text: string } {
  switch (value.state) {
    case 'PROVISIONING': return { heading: 'Préparation de votre espace', text: stepLabel(value.step) };
    case 'READY': return { heading: 'Votre espace est prêt', text: 'L’activation n’est pas disponible actuellement.' };
    case 'ACTIVE': return { heading: 'Votre espace est activé', text: 'Votre espace a été activé.' };
    case 'FAILED': return { heading: 'Préparation à vérifier', text: 'La préparation nécessite une vérification. La reprise n’est pas disponible actuellement. Contactez le propriétaire de votre organisation.' };
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
