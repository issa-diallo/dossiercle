import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Activation } from '@dossiercle/contracts';
import { getActivation, getOnboarding, getSession } from '../lib/agency-api.js';
import { startActivationPolling } from '../lib/activation-polling.js';
import { ActivationStatus } from '../components/activation-status.js';
import { canViewActivation } from '../lib/onboarding-flow.js';

export function AgencyActivationPage() {
  const { id = '' } = useParams(); const navigate = useNavigate();
  const [value, setValue] = useState<Activation>(); const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(true); const [error, setError] = useState(''); const [errorCorrelation, setErrorCorrelation] = useState(''); const [generation, setGeneration] = useState(0);
  const [pollRevision, setPollRevision] = useState(0); const [offline, setOffline] = useState(!navigator.onLine);
  const refreshSequence = useRef(0);
  const errorSummary = useRef<HTMLDivElement>(null); const focusError = useRef(true);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const sequence = ++refreshSequence.current; const current = () => !signal?.aborted && sequence === refreshSequence.current;
    setBusy(true); setError(''); setErrorCorrelation('');
    try {
      const session = await getSession(signal);
      if (!current()) return;
      if (session.scope === 'agency') {
        if (!canViewActivation(session, id)) { setAuthorized(false); setValue(undefined); setError('Cet espace n’est pas disponible pour cette session.'); return; }
      } else if (session.scope === 'onboarding') {
        const accepted = await getOnboarding(signal);
        if (!current()) return;
        if (!canViewActivation(session, id, accepted)) { setAuthorized(false); setValue(undefined); setError('Cet espace n’est pas disponible pour cette session.'); return; }
      } else { setAuthorized(false); setValue(undefined); setError('Cet espace n’est pas disponible pour cette session.'); return; }
      const currentValue = await getActivation(id, signal);
      if (!current()) return;
      focusError.current = false; setAuthorized(true); setValue(currentValue); setPollRevision(revision => revision + 1);
    } catch (cause) {
      if (!current()) return;
      setValue(undefined); setAuthorized(false);
      const status = (cause as { status?: number }).status;
      setError(status === 401 ? 'Votre session a expiré. Reconnectez-vous pour continuer.'
        : status === 429 ? 'Trop de vérifications ont été effectuées. Attendez avant de vérifier à nouveau.'
          : 'Impossible de vérifier cet espace.');
      setErrorCorrelation(correlationFor(cause));
    } finally { if (current()) setBusy(false); }
  }, [id]);
  useEffect(() => { document.title = 'État de votre espace — DossierClé'; document.getElementById('page-title')?.focus(); }, []);
  useEffect(() => {
    if (!error || !focusError.current) return;
    focusError.current = false; errorSummary.current?.focus();
  }, [error]);
  useEffect(() => { const controller = new AbortController(); void refresh(controller.signal); return () => controller.abort(); }, [refresh, generation]);
  useEffect(() => {
    const network = () => setOffline(!navigator.onLine);
    window.addEventListener('offline', network); window.addEventListener('online', network);
    network(); return () => { window.removeEventListener('offline', network); window.removeEventListener('online', network); };
  }, []);
  useEffect(() => {
    if (!value || value.state !== 'PROVISIONING') return;
    return startActivationPolling({ read: async (signal, poll) => {
      if (!poll) {
        const session = await getSession(signal);
        const accepted = session.scope === 'onboarding' ? await getOnboarding(signal) : null;
        if (!canViewActivation(session, id, accepted)) throw Object.assign(new Error('FORBIDDEN'), { status: 403 });
      }
      return getActivation(id, signal, poll);
    }, onValue: latest => { focusError.current = false; setAuthorized(true); setValue(latest); setError(''); setErrorCorrelation(''); }, onError: error => {
      focusError.current = false;
      const status = (error as { status?: number }).status;
      if ([401, 403, 404].includes(status ?? 0)) { setAuthorized(false); setValue(undefined); setError('Cet espace n’est pas disponible pour cette session.'); }
      else setError('La vérification a été interrompue. Le dernier état affiché peut ne plus être actuel. Vérifiez l’état pour relire les données.');
      setErrorCorrelation(correlationFor(error));
    },
    onExpired: () => { focusError.current = false; setError('La surveillance automatique est terminée. Vérifiez l’état pour actualiser votre espace.'); },
  });
  }, [id, value?.state, pollRevision]);
  return <main id="main" className="shell" aria-busy={busy}>
    <header className="brand"><Link to="/onboarding">DossierClé</Link><span>État de votre espace</span></header>
    <section className="card" aria-labelledby="page-title">
      <h1 id="page-title" tabIndex={-1}>Suivre la préparation</h1>
      {busy && !value && <p role="status">Vérification de votre espace…</p>}
      {error && <div id="activation-error-summary" role="alert" className="error-summary" tabIndex={-1} ref={errorSummary}><p className="error">{error}</p>{errorCorrelation && <p className="error-reference">Référence : {errorCorrelation}</p>}<a href="#verify-state">Aller à la vérification</a><span className="error-actions"><button type="button" id="verify-state" onClick={() => { focusError.current = true; setGeneration(g => g + 1); }} disabled={busy}>Vérifier l’état</button><button type="button" onClick={() => navigate('/onboarding')}>Retour à la préparation</button></span></div>}
      {offline && <p className="network-banner" role="status">Hors ligne. Le dernier état vérifié peut ne plus être actuel.</p>}
      {value && authorized && <><p className="agency-name">{value.name}</p><ActivationStatus value={value} busy={busy}/><p className="quiet-note">Aucune fonction IA ni connexion e-mail n’est activée.</p>{!error && <button type="button" id="verify-state" onClick={() => { focusError.current = true; setGeneration(g => g + 1); }} disabled={busy}>Vérifier l’état</button>}</>}
      <button className="link-button" type="button" onClick={() => navigate('/onboarding')}>Retour à la préparation</button>
    </section>
  </main>;
}
function correlationFor(error: unknown): string {
  const value = (error as { correlationId?: unknown }).correlationId;
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : '';
}
