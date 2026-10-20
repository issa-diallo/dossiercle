import type { Activation } from '@dossiercle/contracts';
import { activationLabel } from '../lib/onboarding-flow.js';

export function ActivationStatus({ value, busy = false }: { value: Activation; busy?: boolean }) {
  const label = activationLabel(value);
  return <section className="status-panel" role="status" aria-live="polite" aria-atomic="true" aria-labelledby="activation-heading" aria-busy={busy}>
    <p className={`status-mark status-${value.state.toLowerCase()}`}>{value.state === 'ACTIVE' ? 'Activé' : value.state === 'READY' ? 'Prêt' : value.state === 'FAILED' ? value.canRetry ? 'Reprise possible' : 'À vérifier' : 'En cours'}</p>
    <h2 id="activation-heading">{label.heading}</h2>
    <p>{label.text}</p>
  </section>;
}
