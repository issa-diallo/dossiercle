export type PollingOptions<T extends { state: string }> = {
  read: (signal: AbortSignal, poll: boolean) => Promise<T>;
  onValue: (value: T) => void;
  onError: (error: unknown) => void;
  visible?: () => boolean;
  online?: () => boolean;
  now?: () => number;
  setTimer?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
  addListener?: (event: 'online' | 'offline' | 'visibilitychange', listener: () => void) => void;
  removeListener?: (event: 'online' | 'offline' | 'visibilitychange', listener: () => void) => void;
  onExpired?: () => void;
};
export function startActivationPolling<T extends { state: string }>(options: PollingOptions<T>): () => void {
  const now = options.now ?? Date.now, setTimer = options.setTimer ?? setTimeout, clearTimer = options.clearTimer ?? clearTimeout;
  const visible = options.visible ?? (() => document.visibilityState === 'visible');
  const online = options.online ?? (() => navigator.onLine);
  const end = now() + 600_000; let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false, active: AbortController | undefined, generation = 0, resuming = false, resumeGeneration = 0;
  const clearPending = () => { if (timer) clearTimer(timer); timer = undefined; active?.abort(); active = undefined; generation++; };
  let detach = () => {};
  const shutdown = (expired: boolean) => {
    if (stopped) return;
    stopped = true; clearPending(); if (expiry) clearTimer(expiry); detach();
    if (expired) options.onExpired?.();
  };
  const expire = () => shutdown(true);
  const expiry = setTimer(expire, 600_000);
  const schedule = (delay: number) => {
    if (stopped) return;
    if (now() >= end) { expire(); return; }
    if (!visible() || !online()) return;
    timer = setTimer(() => { void tick(); }, Math.min(delay, Math.max(0, end - now())));
  };
  const read = async (poll: boolean) => {
    if (stopped || now() >= end || !visible() || !online()) return;
    active = new AbortController();
    const thisGeneration = ++generation, controller = active;
    let delay = 20_000;
    try {
      const value = await options.read(controller.signal, poll); if (stopped || controller.signal.aborted || thisGeneration !== generation) return;
      options.onValue(value);
      if (value.state !== 'PROVISIONING') { shutdown(false); return; }
    } catch (error) {
      if (stopped || controller.signal.aborted || thisGeneration !== generation) return;
      options.onError(error);
      const failure = error as { status?: number; retryAfter?: number };
      if ([401, 403, 404].includes(failure.status ?? 0)) { shutdown(false); return; }
      delay = Math.max(30_000, (failure.retryAfter ?? 0) * 1000);
    }
    schedule(delay);
  };
  const tick = () => read(true);
  const pause = () => { if (!stopped) { clearPending(); resuming = false; resumeGeneration++; } };
  const resume = () => {
    if (stopped || now() >= end) { if (!stopped) expire(); return; }
    if (!visible() || !online() || resuming) return;
    if (timer) clearTimer(timer); timer = undefined;
    resuming = true; const thisResume = ++resumeGeneration;
    void read(false).finally(() => { if (thisResume === resumeGeneration) resuming = false; });
  };
  const onVisibility = () => visible() ? resume() : pause();
  const onOnline = () => online() ? resume() : pause();
  const add = options.addListener ?? ((event, listener) => {
    if (typeof window === 'undefined') return;
    if (event === 'visibilitychange') document.addEventListener(event, listener); else window.addEventListener(event, listener);
  });
  const remove = options.removeListener ?? ((event, listener) => {
    if (typeof window === 'undefined') return;
    if (event === 'visibilitychange') document.removeEventListener(event, listener); else window.removeEventListener(event, listener);
  });
  const onOffline = () => pause();
  detach = () => { remove('visibilitychange', onVisibility); remove('online', onOnline); remove('offline', onOffline); };
  add('visibilitychange', onVisibility); add('online', onOnline); add('offline', onOffline);
  schedule(20_000);
  const stop = () => shutdown(false);
  return stop;
}
