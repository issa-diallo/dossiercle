import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { BootstrapReauthStart, CreateAgency } from '@dossiercle/contracts';
import { bootstrapReauthContext, claim, createAgency, getOnboarding, getSession, startBootstrapReauth } from '../lib/agency-api.js';
import { reconcile, type Flow } from '../lib/onboarding-flow.js';

const genericError = 'Impossible de vérifier votre espace. Réessayez ou contactez votre administrateur.';
export function OnboardingPage() {
  const [flow, setFlow] = useState<Flow>({ state: 'loading' });
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [errorCorrelation, setErrorCorrelation] = useState(''); const [name, setName] = useState('');
  const [email, setEmail] = useState(''); const navigate = useNavigate();
  const [uncertain, setUncertain] = useState(false); const createAttempt = useRef<{ name: string; key: string } | undefined>(undefined);
  const requestGeneration = useRef(0);
  const reauthController = useRef<AbortController | undefined>(undefined);
  const errorSummary = useRef<HTMLDivElement>(null); const focusError = useRef(false);
  const load = async (signal?: AbortSignal) => {
    const generation = ++requestGeneration.current;
    const current = () => !signal?.aborted && generation === requestGeneration.current;
    const session = await getSession(signal);
    if (!current()) return { state: 'loading' } as Flow;
    const agency = session.scope === 'onboarding' ? await getOnboarding(signal) : null;
    if (!current()) return { state: 'loading' } as Flow;
    const next = reconcile(session, agency); setFlow(next);
    if (next.state === 'created' && next.agencyId) navigate(`/agencies/${next.agencyId}/activation`, { replace: true });
    return next;
  };
  useEffect(() => {
    const controller = new AbortController();
    const generation = requestGeneration.current + 1;
    document.title = 'Préparation de votre espace — DossierClé';
    document.getElementById('page-title')?.focus();
    void load(controller.signal).catch(e => { if (!controller.signal.aborted && generation === requestGeneration.current) { setFlow({ state: (e as { status?: number }).status === 401 ? 'denied' : 'error' }); setError(messageFor(e)); setErrorCorrelation(correlationFor(e)); } });
    return () => { ++requestGeneration.current; controller.abort(); reauthController.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!error || !focusError.current) return;
    focusError.current = false;
    errorSummary.current?.focus();
  }, [error]);
  const act = async (work: () => Promise<void>) => {
    setBusy(true); setError(''); setErrorCorrelation('');
    try { await work(); } catch (e) {
      focusError.current = true;
      const status = (e as { status?: number }).status;
      setErrorCorrelation(correlationFor(e));
      if (status === 401 || status === 403) {
        ++requestGeneration.current;
        reauthController.current?.abort(); reauthController.current = undefined;
        setFlow({ state: status === 401 ? 'denied' : 'error' });
        setName(''); setUncertain(false);
      }
      setError(messageFor(e));
    }
    finally { setBusy(false); }
  };
  const acceptInvitation = () => act(async () => {
    const generation = ++requestGeneration.current;
    const current = () => generation === requestGeneration.current;
    const session = flow.session; if (!session) throw new Error('SESSION_UNAVAILABLE');
    await claim(session.csrfToken);
    if (!current()) return;
    setFlow({ state: 'create', session });
  });
  const submitName = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const parsed = CreateAgency.safeParse({ name });
    if (!parsed.success) { focusError.current = true; setError('Saisissez un nom de 1 à 120 caractères.'); return; }
    void act(async () => {
      if (!flow.session) throw new Error('SESSION_UNAVAILABLE');
      const attempt = createAttempt.current?.name === parsed.data.name ? createAttempt.current : { name: parsed.data.name, key: crypto.randomUUID() };
      createAttempt.current = attempt; setUncertain(true);
      const accepted = await createAgency(parsed.data.name, flow.session.csrfToken, attempt.key);
      createAttempt.current = undefined; setUncertain(false); navigate(`/agencies/${accepted.agencyId}/activation`);
    });
  };
  const reauthenticate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const selected = BootstrapReauthStart.safeParse({ email });
    if (!selected.success) { focusError.current = true; setError('Saisissez une adresse e-mail valide.'); return; }
    void act(async () => {
      reauthController.current?.abort();
      const controller = new AbortController(); reauthController.current = controller;
      const generation = ++requestGeneration.current;
      const current = () => !controller.signal.aborted && generation === requestGeneration.current;
      const context = await bootstrapReauthContext(controller.signal);
      if (!current()) return;
      const start = await startBootstrapReauth(selected.data.email, context.csrfNonce, controller.signal);
      if (!current()) return;
      window.location.assign(start.continueUrl);
    });
  };
  return <main id="main" className="shell" aria-busy={busy}>
    <header className="brand"><a href="/app/onboarding" aria-label="DossierClé, accueil">DossierClé</a><span>Préparation de votre espace</span></header>
    <section className="card" aria-labelledby="page-title">
      <h1 id="page-title" tabIndex={-1}>Préparer votre espace</h1>
      {flow.state === 'loading' && <p role="status">Vérification de votre espace…</p>}
      {flow.state === 'denied' && <><p role="status">Votre session doit être renouvelée pour continuer.</p><form onSubmit={reauthenticate} noValidate><label htmlFor="reauth-email">Adresse e-mail du compte</label><input id="reauth-email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} aria-describedby="reauth-help"/><p id="reauth-help">Vous poursuivrez la connexion auprès du service d’identité.</p><button type="submit" disabled={busy}>Se reconnecter</button></form></>}
      {flow.state === 'claim' && <><p>Votre session est prête. Confirmez votre invitation pour continuer.</p><button id="continue-invitation" type="button" onClick={acceptInvitation} disabled={busy}>{busy ? 'Vérification…' : 'Continuer avec mon invitation'}</button></>}
      {flow.state === 'create' && <form onSubmit={submitName} noValidate><p>Choisissez le nom de votre espace. Vous pourrez suivre sa préparation après sa création.</p><label htmlFor="agency-name">Nom de l’espace</label><input id="agency-name" name="name" autoComplete="organization" required value={name} onChange={e => setName(e.target.value)} disabled={uncertain} aria-invalid={Boolean(error)} aria-describedby={error ? 'form-error' : 'name-help'}/><p id="name-help">1 à 120 caractères.</p><button type="submit" disabled={busy || uncertain}>{busy ? 'Création en cours…' : 'Créer mon espace'}</button>{uncertain && <button type="button" onClick={() => void act(async () => { const next = await load(); if (next.state === 'claim') setUncertain(false); })} disabled={busy}>Vérifier l’état avant de continuer</button>}</form>}
      {flow.state === 'error' && <><p role="status">{genericError}</p><button id="verify-again" type="button" onClick={() => void act(async () => { await load(); })} disabled={busy}>Vérifier à nouveau</button></>}
      {error && <div className="error-summary" id="form-error-summary" role="alert" tabIndex={-1} ref={errorSummary}><p className="error" id="form-error">{error}</p><a href={flow.state === 'create' ? '#agency-name' : flow.state === 'denied' ? '#reauth-email' : flow.state === 'claim' ? '#continue-invitation' : '#verify-again'}>Aller à l’action suivante</a>{errorCorrelation && <p className="error-reference">Référence : {errorCorrelation}</p>}</div>}
      <p className="quiet-note">Aucune fonction IA ni connexion e-mail n’est activée.</p>
    </section>
  </main>;
}
function messageFor(error: unknown): string {
  const status = (error as { status?: number }).status;
  if (status === 401) return 'Votre session a expiré. Reconnectez-vous pour continuer.';
  if (status === 403 || status === 404) return genericError;
  if (status === 429) return 'Trop de demandes ont été effectuées. Attendez avant de réessayer.';
  if (error instanceof Error && error.message === 'REQUEST_BUDGET_EXHAUSTED') return 'La limite de vérification est atteinte. Vérifiez à nouveau dans une minute.';
  return genericError;
}
function correlationFor(error: unknown): string {
  const correlationId = (error as unknown as { correlationId?: unknown }).correlationId;
  return typeof correlationId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(correlationId) ? correlationId : '';
}
