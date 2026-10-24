import { describe, expect, it, vi, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { execFileSync } from 'node:child_process';
// The same inert controller the CLI calls, with no pg, .local or Docker imports.
const modulePath = new URL('../../../scripts/s01-t06-drain.mjs', import.meta.url).href;
const inertCode = [
  "import{registerHooks}from'node:module';",
  'const target=' + JSON.stringify(modulePath) + ';',
  "const allowed=new Set(['node:perf_hooks','node:timers/promises','node:path','node:url']);",
  "registerHooks({resolve(specifier,context,next){if(specifier!==target&&!allowed.has(specifier))throw Error('NATIVE_IMPORT_REFUSED');return next(specifier,context);}});",
  "try{const module=await import(target);process.stdout.write(typeof module.drainIdentifiedRuntime==='function'&&typeof module.acquireDrainSession==='function'?'INERT':'INVALID_EXPORT');}catch{process.stdout.write('IMPORT_GUARD_FAILED');process.exitCode=1;}",
].join('\n');
const inertImport = execFileSync(process.execPath, ['--input-type=module', '-e', inertCode], { encoding: 'utf8', timeout: 5000 });
if (inertImport !== 'INERT') throw new Error('DRAIN_CONTROLLER_IMPORT_NOT_INERT');
const { drainIdentifiedRuntime, acquireDrainSession } = await import(modulePath);

type Result = { rows: Record<string, unknown>[] };
function harness(locks: boolean[] = [true], gate: Result = { rows: [{ state: 'IDLE', execution_id: null }] }) {
  const events: string[] = [], budgets: number[] = [];
  let time = 0, lockIndex = 0, healthy = true;
  const session = {
    healthy: () => healthy,
    query: vi.fn(async (sql: string, budget: number): Promise<Result> => {
      budgets.push(budget);
      if (sql.includes('pg_try_advisory_lock')) { events.push('lock'); return { rows: [{ locked: locks[Math.min(lockIndex++, locks.length - 1)] }] }; }
      events.push('gate'); return gate;
    }),
    retire: vi.fn(async () => { events.push('destroy-session-confirmed'); }),
  };
  const ports = {
    stopOrchestrator: vi.fn(async () => { events.push('stop-orchestrator'); }),
    acquireSession: vi.fn(async () => { events.push('connect-dedicated'); return session; }),
    stopProvisioner: vi.fn(async () => { events.push('stop-provisioner'); }),
    onDrained: vi.fn(async () => { events.push('PASS'); }),
    now: () => time,
    wait: vi.fn(async (milliseconds: number) => { events.push('wait'); time += milliseconds; }),
  };
  return { session, ports, events, budgets, advance: (milliseconds: number) => { time += milliseconds; }, lose: () => { healthy = false; } };
}
afterEach(() => { vi.useRealTimers(); });

describe('identified T06 drain quiescence', () => {
  it('imports the actual controller while native, pg and filesystem dependencies are refused', () => {
    expect(inertImport).toBe('INERT');
  });
  it('waits only for false, acquires once and keeps stop/PASS behind the exact guard and retirement', async () => {
    const h = harness([false, true]);
    await expect(drainIdentifiedRuntime(h.ports)).resolves.toEqual({ attempts: 2, waitedMs: 100 });
    expect(h.events).toEqual(['stop-orchestrator', 'connect-dedicated', 'lock', 'wait', 'lock', 'gate', 'stop-provisioner', 'destroy-session-confirmed', 'PASS']);
    expect(h.session.query).toHaveBeenCalledTimes(3); expect(h.session.retire).toHaveBeenCalledOnce();
    expect(h.ports.acquireSession).toHaveBeenCalledOnce(); expect(h.budgets.every(value => value > 0 && value <= 1000)).toBe(true);
  });
  it('does not delay an immediately quiescent runtime', async () => {
    const h = harness(); await drainIdentifiedRuntime(h.ports);
    expect(h.ports.wait).not.toHaveBeenCalled(); expect(h.session.query).toHaveBeenCalledTimes(2); expect(h.session.retire).toHaveBeenCalledOnce();
  });
  it('refuses persistent contention at the monotone deadline without gate, provisioner stop or PASS', async () => {
    const h = harness([false]);
    await expect(drainIdentifiedRuntime(h.ports)).rejects.toThrow('T06_DRAIN_EXECUTION_IN_PROGRESS');
    expect(h.ports.now()).toBe(5000); expect(h.events.includes('gate')).toBe(false);
    expect(h.ports.stopProvisioner).not.toHaveBeenCalled(); expect(h.ports.onDrained).not.toHaveBeenCalled(); expect(h.session.retire).toHaveBeenCalledOnce();
  });
  it.each([
    { rows: [{ state: 'RUNNING', execution_id: 'opaque' }] },
    { rows: [{ state: 'BLOCKED', execution_id: 'opaque' }] },
    { rows: [{ state: 'IDLE', execution_id: 'opaque' }] },
    { rows: [] },
  ])('refuses a nonquiescent or missing gate immediately %#', async gate => {
    const h = harness([true], gate);
    await expect(drainIdentifiedRuntime(h.ports)).rejects.toThrow('T06_DRAIN_RECONCILIATION_REQUIRED');
    expect(h.session.query).toHaveBeenCalledTimes(2); expect(h.ports.wait).not.toHaveBeenCalled();
    expect(h.ports.stopProvisioner).not.toHaveBeenCalled(); expect(h.ports.onDrained).not.toHaveBeenCalled(); expect(h.session.retire).toHaveBeenCalledOnce();
  });
  it('never retries a rejected SQL probe and does not publish its original diagnostic', async () => {
    const h = harness(); h.session.query.mockRejectedValueOnce(new Error('PRIVATE_SENTINEL'));
    const failure = await drainIdentifiedRuntime(h.ports).catch((error: Error) => error);
    expect(failure.message).toBe('T06_DRAIN_GUARD_UNAVAILABLE'); expect(failure.stack.includes('PRIVATE_SENTINEL')).toBe(false);
    expect(h.session.query).toHaveBeenCalledOnce(); expect(h.session.retire).toHaveBeenCalledOnce(); expect(h.ports.wait).not.toHaveBeenCalled(); expect(h.ports.stopProvisioner).not.toHaveBeenCalled();
  });
  it('destroys a session lost during waiting without another query or reconnect', async () => {
    const h = harness([false]); h.ports.wait.mockImplementationOnce(async () => { h.lose(); h.advance(100); });
    await expect(drainIdentifiedRuntime(h.ports)).rejects.toThrow('T06_DRAIN_GUARD_UNAVAILABLE');
    expect(h.session.query).toHaveBeenCalledOnce(); expect(h.session.retire).toHaveBeenCalledOnce(); expect(h.ports.acquireSession).toHaveBeenCalledOnce(); expect(h.ports.stopProvisioner).not.toHaveBeenCalled();
  });
  it('refuses a late successful acquisition and never queues a gate or unlock behind it', async () => {
    const h = harness(); h.session.query.mockImplementationOnce(async () => { h.advance(5001); return { rows: [{ locked: true }] }; });
    await expect(drainIdentifiedRuntime(h.ports)).rejects.toThrow('T06_DRAIN_EXECUTION_IN_PROGRESS');
    expect(h.session.query).toHaveBeenCalledOnce(); expect(h.session.retire).toHaveBeenCalledOnce(); expect(h.ports.stopProvisioner).not.toHaveBeenCalled(); expect(h.ports.onDrained).not.toHaveBeenCalled();
  });
  it('refuses a late gate read without retry or stop', async () => {
    const h = harness(); const actualQuery = h.session.query.getMockImplementation()!;
    h.session.query.mockImplementation(async (sql, budget) => { const result = await actualQuery(sql, budget); if (!sql.includes('pg_try_advisory_lock')) h.advance(1001); return result; });
    await expect(drainIdentifiedRuntime(h.ports)).rejects.toThrow('T06_DRAIN_GUARD_UNAVAILABLE');
    expect(h.session.query).toHaveBeenCalledTimes(2); expect(h.session.retire).toHaveBeenCalledOnce(); expect(h.ports.stopProvisioner).not.toHaveBeenCalled();
  });
  it('times out an indeterminate probe, retires once, and ignores a late response forever', async () => {
    vi.useFakeTimers(); const h = harness(); let resolveLate: ((result: Result) => void) | undefined;
    h.session.query.mockImplementationOnce(() => new Promise<Result>(resolve => { resolveLate = resolve; }));
    const pending = drainIdentifiedRuntime(h.ports).catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(1000);
    expect((await pending).message).toBe('T06_DRAIN_GUARD_UNAVAILABLE');
    resolveLate?.({ rows: [{ locked: true }] }); await Promise.resolve();
    expect(h.session.query).toHaveBeenCalledOnce(); expect(h.session.retire).toHaveBeenCalledOnce(); expect(h.ports.stopProvisioner).not.toHaveBeenCalled(); expect(h.ports.onDrained).not.toHaveBeenCalled();
  });
  it.each(['reject', 'unconfirmed'])('requires confirmed session retirement before PASS: %s', async mode => {
    vi.useFakeTimers(); const h = harness();
    if (mode === 'reject') h.session.retire.mockRejectedValueOnce(new Error('PRIVATE_SENTINEL'));
    else h.session.retire.mockImplementationOnce(() => new Promise<void>(() => {}));
    const pending = drainIdentifiedRuntime(h.ports).catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(1000);
    expect((await pending).message).toBe('T06_DRAIN_SESSION_CLOSE_UNCONFIRMED'); expect(h.session.retire).toHaveBeenCalledOnce(); expect(h.ports.onDrained).not.toHaveBeenCalled();
  });
  it('does not accept a close receipt received after its monotone deadline', async () => {
    const h = harness(); h.session.retire.mockImplementationOnce(async () => { h.advance(1001); });
    await expect(drainIdentifiedRuntime(h.ports)).rejects.toThrow('T06_DRAIN_SESSION_CLOSE_UNCONFIRMED');
    expect(h.session.retire).toHaveBeenCalledOnce(); expect(h.ports.onDrained).not.toHaveBeenCalled();
  });
  it.each(['orchestrator', 'connect', 'provisioner'])('does not retry a failing external operation: %s', async stage => {
    const h = harness();
    if (stage === 'orchestrator') h.ports.stopOrchestrator.mockRejectedValueOnce(new Error('PRIVATE_SENTINEL'));
    if (stage === 'connect') h.ports.acquireSession.mockRejectedValueOnce(new Error('PRIVATE_SENTINEL'));
    if (stage === 'provisioner') h.ports.stopProvisioner.mockRejectedValueOnce(new Error('PRIVATE_SENTINEL'));
    await expect(drainIdentifiedRuntime(h.ports)).rejects.toThrow(stage === 'orchestrator' ? 'T06_DRAIN_ORCHESTRATOR_STOP_FAILED' : stage === 'connect' ? 'T06_DRAIN_CONNECTION_UNAVAILABLE' : 'T06_DRAIN_PROVISIONER_STOP_FAILED');
    expect(h.ports.stopOrchestrator).toHaveBeenCalledOnce(); expect(h.ports.onDrained).not.toHaveBeenCalled(); expect(h.ports.wait).not.toHaveBeenCalled();
    expect(h.ports.acquireSession.mock.calls.length).toBe(stage === 'orchestrator' ? 0 : 1); expect(h.session.retire.mock.calls.length).toBe(stage === 'provisioner' ? 1 : 0);
  });
});

function poolPort(closeOnRelease = true) {
  const client = Object.assign(new EventEmitter(), {
    pipeline: false,
    query: vi.fn(async (config: { text: string; query_timeout: number }): Promise<Result> => { void config; return { rows: [] }; }),
    release: vi.fn((destroy: boolean) => { void destroy; }),
  });
  client.release.mockImplementation(() => { if (closeOnRelease) client.emit('end'); });
  const pool = Object.assign(new EventEmitter(), { connect: vi.fn(async () => client), end: vi.fn(async () => {}) });
  return { pool, client };
}
describe('actual drain dedicated-session adapter', () => {
  it('installs the receipt before destroy release and never pools or unlocks the session', async () => {
    const h = poolPort(); const session = await acquireDrainSession(h.pool);
    expect(h.client.listenerCount('end')).toBe(1); expect(session.healthy()).toBe(true);
    await session.retire();
    expect(h.client.release).toHaveBeenCalledExactlyOnceWith(true); expect(h.pool.end).toHaveBeenCalledOnce();
    expect(h.client.query).not.toHaveBeenCalled(); expect(session.healthy()).toBe(false);
    await expect(session.retire()).rejects.toThrow('T06_DRAIN_SESSION_ALREADY_RETIRED');
    expect(h.client.release).toHaveBeenCalledOnce();
    expect(() => session.query('unused', 100)).toThrow('T06_DRAIN_SESSION_UNAVAILABLE'); expect(h.client.query).not.toHaveBeenCalled();
  });
  it('preserves exact query deadlines on its only client', async () => {
    const h = poolPort(); const session = await acquireDrainSession(h.pool);
    await session.query('guard-read', 375);
    expect(h.client.query).toHaveBeenCalledExactlyOnceWith({ text: 'guard-read', query_timeout: 375 }); await session.retire();
  });
  it.each(['client', 'pool'])('consumes %s errors without leaking their original diagnostic or retrying', async source => {
    const h = poolPort(); const session = await acquireDrainSession(h.pool);
    expect(() => (source === 'client' ? h.client : h.pool).emit('error', new Error('PRIVATE_SENTINEL'))).not.toThrow();
    expect(session.healthy()).toBe(false); expect(() => session.query('unused', 100)).toThrow('T06_DRAIN_SESSION_UNAVAILABLE');
    await expect(session.retire()).rejects.toThrow('T06_DRAIN_SESSION_FAILED'); expect(h.client.release).toHaveBeenCalledExactlyOnceWith(true); expect(h.client.query).not.toHaveBeenCalled();
  });
  it('keeps PASS blocked when the real session adapter has no end receipt', async () => {
    vi.useFakeTimers(); const h = harness(), actual = poolPort(false); const session = await acquireDrainSession(actual.pool);
    actual.client.query.mockImplementation(async config => ({ rows: config.text.includes('pg_try_advisory_lock') ? [{ locked: true }] : [{ state: 'IDLE', execution_id: null }] }));
    h.ports.acquireSession.mockResolvedValueOnce(session);
    const pending = drainIdentifiedRuntime(h.ports).catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(1000);
    expect((await pending).message).toBe('T06_DRAIN_SESSION_CLOSE_UNCONFIRMED');
    expect(actual.client.release).toHaveBeenCalledExactlyOnceWith(true); expect(h.ports.onDrained).not.toHaveBeenCalled();
    actual.client.emit('end'); await Promise.resolve(); expect(h.ports.onDrained).not.toHaveBeenCalled();
  });
});
