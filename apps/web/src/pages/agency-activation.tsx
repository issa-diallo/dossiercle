import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Activation, Session } from '@dossiercle/contracts';
import { activateAgency, getActivation, getOnboarding, getSession } from '../lib/agency-api.js';
import { startActivationPolling } from '../lib/activation-polling.js';
import { ActivationStatus } from '../components/activation-status.js';
import { ActivationActionGate, activationCanOpenConfirmation, activationOfferVisible, canViewActivation, confirmationMatches, runActivationCommand, type ActivationConfirmation } from '../lib/onboarding-flow.js';

type CurrentRead = { session: Session; activation: Activation };

export function AgencyActivationPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [value, setValue] = useState<Activation>();
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [errorCorrelation, setErrorCorrelation] = useState('');
  const [generation, setGeneration] = useState(0);
  const [pollRevision, setPollRevision] = useState(0);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [confirmation, setConfirmation] = useState<ActivationConfirmation>();
  const [confirmTitleFocus, setConfirmTitleFocus] = useState(false);
  const [cancelFocus, setCancelFocus] = useState(false);
  const [actionGate] = useState(() => new ActivationActionGate());
  const refreshSequence = useRef(0);
  const actionGeneration = useRef(0);
  const actionController = useRef<AbortController | undefined>(undefined);
  const onboardingAdmission = useRef<{ csrfToken: string; agencyId: string } | undefined>(undefined);
  const activationTrigger = useRef<HTMLButtonElement>(null);
  const confirmationTitle = useRef<HTMLHeadingElement>(null);
  const hadConfirmation = useRef(false);
  const errorSummary = useRef<HTMLDivElement>(null);
  const focusError = useRef(true);

  const readCurrent = useCallback(async (signal?: AbortSignal): Promise<CurrentRead> => {
    const session = await getSession(signal);
    let acceptedAgency: string | undefined;
    if (session.scope === 'onboarding') {
      if (onboardingAdmission.current?.csrfToken === session.csrfToken && onboardingAdmission.current.agencyId === id) {
        acceptedAgency = onboardingAdmission.current.agencyId;
      } else {
        const accepted = await getOnboarding(signal);
        acceptedAgency = accepted?.agencyId;
      }
    }
    const admitted = session.scope === 'agency' ? canViewActivation(session, id)
      : session.scope === 'onboarding' && acceptedAgency === id;
    if (!admitted) {
      onboardingAdmission.current = undefined;
      throw Object.assign(new Error('FORBIDDEN'), { status: 403 });
    }
    if (session.scope === 'onboarding') onboardingAdmission.current = { csrfToken: session.csrfToken, agencyId: id };
    let activation: Activation;
    try { activation = await getActivation(id, signal); }
    catch (cause) {
      if ([401, 403, 404].includes(errorStatus(cause) ?? 0)) onboardingAdmission.current = undefined;
      throw cause;
    }
    if (activation.agencyId !== id) {
      onboardingAdmission.current = undefined;
      throw Object.assign(new Error('FORBIDDEN'), { status: 403 });
    }
    return { session, activation };
  }, [id]);

  const applyCurrent = useCallback((current: CurrentRead) => {
    setAuthorized(true);
    setValue(current.activation);
    setPollRevision(revision => revision + 1);
    setConfirmation(previous => previous && (!confirmationMatches(current.activation, previous) || current.session.csrfToken !== previous.csrfToken) ? undefined : previous);
  }, []);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const sequence = ++refreshSequence.current;
    const current = () => !signal?.aborted && sequence === refreshSequence.current;
    setBusy(true);
    setError('');
    setErrorCorrelation('');
    try {
      const latest = await readCurrent(signal);
      if (!current()) return;
      focusError.current = false;
      applyCurrent(latest);
    } catch (cause) {
      if (!current()) return;
      const status = errorStatus(cause);
      focusError.current = true;
      if ([401, 403, 404].includes(status ?? 0)) {
        setConfirmation(undefined);
        setValue(undefined);
        setAuthorized(false);
      }
      setError(status === 401 ? 'Votre session a expiré. Reconnectez-vous pour continuer.'
        : status === 429 ? 'Trop de vérifications ont été effectuées. Attendez avant de vérifier à nouveau.'
          : [403, 404].includes(status ?? 0) ? 'Cet espace n’est pas disponible pour cette session.'
            : 'Impossible de vérifier cet espace.');
      setErrorCorrelation(correlationFor(cause));
    } finally {
      if (current()) setBusy(false);
    }
  }, [applyCurrent, readCurrent]);

  useEffect(() => {
    document.title = 'État de votre espace — DossierClé';
    document.getElementById('page-title')?.focus();
  }, []);
  useLayoutEffect(() => {
    const generation = ++actionGeneration.current;
    return () => {
      if (actionGeneration.current === generation) actionGeneration.current += 1;
      actionController.current?.abort();
      actionController.current = undefined;
      actionGate.release();
    };
  }, [id]);
  useEffect(() => {
    if (confirmation && confirmTitleFocus) {
      confirmationTitle.current?.focus();
      setConfirmTitleFocus(false);
    }
  }, [confirmation, confirmTitleFocus]);
  useEffect(() => {
    if (hadConfirmation.current && !confirmation) activationTrigger.current?.focus();
    hadConfirmation.current = Boolean(confirmation);
  }, [confirmation]);
  useEffect(() => {
    if (!confirmation && cancelFocus) {
      activationTrigger.current?.focus();
      setCancelFocus(false);
    }
  }, [confirmation, cancelFocus]);
  useEffect(() => {
    if (!error || !focusError.current) return;
    focusError.current = false;
    errorSummary.current?.focus();
  }, [error]);
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh, generation]);
  useEffect(() => {
    const network = () => setOffline(!navigator.onLine);
    window.addEventListener('offline', network);
    window.addEventListener('online', network);
    network();
    return () => { window.removeEventListener('offline', network); window.removeEventListener('online', network); };
  }, []);
  useEffect(() => {
    if (!value || value.state !== 'PROVISIONING') return;
    return startActivationPolling({
      read: async (signal, poll) => {
        if (!poll) {
          const session = await getSession(signal);
          const accepted = session.scope === 'onboarding' ? await getOnboarding(signal) : null;
          if (!canViewActivation(session, id, accepted)) throw Object.assign(new Error('FORBIDDEN'), { status: 403 });
        }
        return getActivation(id, signal, poll);
      },
      onValue: latest => {
        focusError.current = false;
        setAuthorized(true);
        setValue(latest);
        setError('');
        setErrorCorrelation('');
        setConfirmation(previous => previous && !confirmationMatches(latest, previous) ? undefined : previous);
      },
      onError: cause => {
        focusError.current = false;
        const status = errorStatus(cause);
        if ([401, 403, 404].includes(status ?? 0)) {
          setConfirmation(undefined);
          setAuthorized(false);
          setValue(undefined);
          setError('Cet espace n’est pas disponible pour cette session.');
        } else {
          setError('La vérification a été interrompue. Le dernier état affiché peut ne plus être actuel. Vérifiez l’état pour relire les données.');
        }
        setErrorCorrelation(correlationFor(cause));
      },
      onExpired: () => {
        focusError.current = false;
        setError('La surveillance automatique est terminée. Vérifiez l’état pour actualiser votre espace.');
      },
    });
  }, [id, value?.state, pollRevision]);

  const openConfirmation = async () => {
    if (busy || value?.state !== 'READY' || !actionGate.acquire()) return;
    const operation = actionGeneration.current;
    const controller = new AbortController();
    actionController.current = controller;
    const current = () => operation === actionGeneration.current && !controller.signal.aborted;
    focusError.current = true;
    setBusy(true);
    setError('');
    try {
      const latest = await readCurrent(controller.signal);
      if (!current()) return;
      applyCurrent(latest);
      if (!activationCanOpenConfirmation(latest.activation, value.version)) {
        setError('L’état de votre espace a changé. Relisez les informations avant de continuer.');
        return;
      }
      setConfirmation({ agencyId: id, version: latest.activation.version, csrfToken: latest.session.csrfToken, idempotencyKey: crypto.randomUUID() });
      setConfirmTitleFocus(true);
    } catch (cause) {
      if (!current()) return;
      const status = errorStatus(cause);
      if ([401, 403, 404].includes(status ?? 0)) {
        setConfirmation(undefined);
        setAuthorized(false);
        setValue(undefined);
      }
      setError(status === 401 ? 'Votre session a expiré. Reconnectez-vous pour continuer.'
        : status === 429 ? 'Trop de vérifications ont été effectuées. Attendez avant de vérifier à nouveau.'
          : [403, 404].includes(status ?? 0) ? 'Cet espace n’est pas disponible pour cette session.'
            : 'Impossible de vérifier cet espace.');
      setErrorCorrelation(correlationFor(cause));
    } finally {
      if (actionController.current === controller) actionController.current = undefined;
      actionGate.release();
      if (current()) setBusy(false);
    }
  };

  const verifyOnly = async () => {
    if (!actionGate.acquire()) return;
    const operation = actionGeneration.current;
    const controller = new AbortController();
    actionController.current = controller;
    const current = () => operation === actionGeneration.current && !controller.signal.aborted;
    focusError.current = true;
    setBusy(true);
    setError('');
    try {
      const latest = await readCurrent(controller.signal);
      if (!current()) return;
      applyCurrent(latest);
      if (confirmation && latest.session.csrfToken !== confirmation.csrfToken) {
        setConfirmation(undefined);
        setError('Votre session a changé. Relisez l’état avant de confirmer une action.');
      }
    } catch (cause) {
      if (!current()) return;
      const status = errorStatus(cause);
      if ([401, 403, 404].includes(status ?? 0)) {
        setConfirmation(undefined);
        setAuthorized(false);
        setValue(undefined);
      }
      setError(status === 401 ? 'Votre session a expiré. Reconnectez-vous pour continuer.'
        : status === 429 ? 'Trop de vérifications ont été effectuées. Attendez avant de vérifier à nouveau.'
          : [403, 404].includes(status ?? 0) ? 'Cet espace n’est pas disponible pour cette session.'
            : 'Impossible de vérifier cet espace.');
      setErrorCorrelation(correlationFor(cause));
    } finally {
      if (actionController.current === controller) actionController.current = undefined;
      actionGate.release();
      if (current()) setBusy(false);
    }
  };

  const confirmActivation = async () => {
    const intent = confirmation;
    if (!intent || busy) return;
    const operation = actionGeneration.current;
    const controller = new AbortController();
    const current = () => operation === actionGeneration.current && !controller.signal.aborted;
    const attempt = runActivationCommand({
      gate: actionGate, intent, targetAgencyId: id, isCurrent: current,
      onAcquired: () => { actionController.current = controller; },
      readCurrent: () => readCurrent(controller.signal),
      activate: (csrf, key, version) => activateAgency(id, csrf, key, version, controller.signal),
    });
    if (!attempt) return;
    focusError.current = true;
    setBusy(true);
    setError('');
    setErrorCorrelation('');
    try {
      const result = await attempt;
      if (!current() || result.kind === 'stale') return;
      if (result.kind === 'session-changed') {
        applyCurrent(result.current);
        setConfirmation(undefined);
        focusError.current = true;
        setError('Votre session a changé. Relisez l’état avant de confirmer une action.');
        return;
      }
      if (result.kind === 'already-active') {
        applyCurrent(result.current);
        setConfirmation(undefined);
        return;
      }
      if (result.kind === 'changed') {
        applyCurrent(result.current);
        setConfirmation(undefined);
        focusError.current = true;
        setError('La version de préparation a changé. Vérifiez les informations et confirmez à nouveau.');
        return;
      }
      applyCurrent(result.current);
      setConfirmation(undefined);
    } catch (cause) {
      if (!current()) return;
      const status = errorStatus(cause);
      if ([401, 403, 404].includes(status ?? 0)) {
        setConfirmation(undefined);
        setAuthorized(false);
        setValue(undefined);
        setError('Cet espace n’est pas disponible pour cette session.');
      } else if (status === 409) {
        setConfirmation(undefined);
        focusError.current = true;
        setError('La préparation a changé. Vérifiez son état avant une nouvelle confirmation.');
        try {
          const latest = await readCurrent(controller.signal);
          if (current()) applyCurrent(latest);
        } catch (readFailure) {
          const readStatus = errorStatus(readFailure);
          if (current() && [401, 403, 404].includes(readStatus ?? 0)) {
            setConfirmation(undefined);
            setAuthorized(false);
            setValue(undefined);
            setError('Cet espace n’est pas disponible pour cette session.');
          }
        }
      } else if (status === 429) {
        focusError.current = true;
        setError('L’activation est temporairement limitée. Attendez avant de confirmer à nouveau.');
        setErrorCorrelation(correlationFor(cause));
      } else {
        focusError.current = true;
        setError('Le résultat de l’activation est incertain. Vérifiez l’état avant toute nouvelle action.');
        setErrorCorrelation(correlationFor(cause));
      }
    } finally {
      if (actionController.current === controller) actionController.current = undefined;
      actionGate.release();
      if (current()) setBusy(false);
    }
  };

  const routeValue = value?.agencyId === id ? value : undefined;
  const readyToActivate = authorized && routeValue !== undefined && activationOfferVisible(routeValue);
  const confirmationCurrent = Boolean(routeValue && confirmation && confirmationMatches(routeValue, confirmation));

  return <main id="main" className="shell" aria-busy={busy}>
    <header className="brand"><Link to="/onboarding">DossierClé</Link><span>État de votre espace</span></header>
    <section className="card" aria-labelledby="page-title">
      <h1 id="page-title" tabIndex={-1}>Suivre la préparation</h1>
      {busy && !value && <p role="status">Vérification de votre espace…</p>}
      {error && <div id="activation-error-summary" role="alert" className="error-summary" tabIndex={-1} ref={errorSummary}>
        <p className="error">{error}</p>
        {errorCorrelation && <p className="error-reference">Référence : {errorCorrelation}</p>}
        <a href="#verify-state">Aller à la vérification</a>
        <span className="error-actions">
          <button type="button" id="verify-state" onClick={() => { focusError.current = true; setGeneration(g => g + 1); }} disabled={busy}>Vérifier l’état</button>
          <button type="button" onClick={() => navigate('/onboarding')}>Retour à la préparation</button>
        </span>
      </div>}
      {offline && <p className="network-banner" role="status">Hors ligne. Le dernier état vérifié peut ne plus être actuel.</p>}
      {routeValue && authorized && <>
        <p className="agency-name">{routeValue.name}</p>
        <ActivationStatus value={routeValue} busy={busy}/>
        <p className="quiet-note">Aucune fonction IA ni connexion e-mail n’est activée.</p>
        {readyToActivate && !confirmation && <button id="start-activation" ref={activationTrigger} type="button" onClick={() => void openConfirmation()} disabled={busy}>Activer mon espace</button>}
        {routeValue.state === 'READY' && confirmation && confirmationCurrent && <section className="activation-confirmation" aria-labelledby="activation-confirmation-title">
          <h2 id="activation-confirmation-title" tabIndex={-1} ref={confirmationTitle}>Confirmer l’activation</h2>
          <p>Vous activez l’espace <strong>{routeValue.name}</strong> (version {routeValue.version}).</p>
          <p>Cette action rendra l’espace actif. Aucune fonction IA ni connexion e-mail ne sera activée.</p>
          <button type="button" onClick={() => void confirmActivation()} disabled={busy}>Confirmer l’activation</button>
          <button className="link-button" type="button" onClick={() => { setConfirmation(undefined); setCancelFocus(true); }} disabled={busy}>Revenir</button>
        </section>}
        {!confirmation && <button type="button" id="verify-state" onClick={() => void verifyOnly()} disabled={busy}>Vérifier l’état</button>}
      </>}
      <button className="link-button" type="button" onClick={() => navigate('/onboarding')}>Retour à la préparation</button>
    </section>
  </main>;
}

function errorStatus(error: unknown): number | undefined {
  const status = (error as { status?: unknown })?.status;
  return typeof status === 'number' ? status : undefined;
}

function correlationFor(error: unknown): string {
  const value = (error as { correlationId?: unknown }).correlationId;
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : '';
}
