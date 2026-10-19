import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { BootstrapReauth } from '../src/identity/bootstrap-reauth.js';

const actor = { subject: randomUUID(), root: randomUUID(), epoch: 3n, scope: 'onboarding' as const, version: '2', tokenHash: 'a'.repeat(64), admissionReceipt: randomUUID() };
const make = (now: { value: number }) => new BootstrapReauth({ decoyKey: Buffer.alloc(32, 9), now: () => now.value });

describe('bootstrap native reauthentication context', () => {
  it('binds a one-use pre-auth nonce to the cookie and expires the challenge', () => {
    const now = { value: 1_000 }, auth = make(now), context = auth.createContext('127.0.0.1');
    expect(() => auth.begin({ cookie: context.cookie, nonce: 'x'.repeat(43), ip: '127.0.0.1', email: 'owner@example.invalid', actor })).toThrow('BOOTSTRAP_REAUTH_CLOSED');
    const started = auth.begin({ cookie: context.cookie, nonce: context.nonce, ip: '127.0.0.1', email: 'owner@example.invalid', actor });
    expect(started.subject).toBe(actor.subject);
    now.value += 5 * 60_000;
    expect(() => auth.take(context.cookie, 'A'.repeat(43))).toThrow('BOOTSTRAP_REAUTH_CLOSED');
  });

  it('uses a stable, purpose-separated UUID decoy for unknown email selectors', () => {
    const auth = make({ value: 1_000 });
    const first = auth.decoy('Nobody@EXAMPLE.INVALID');
    expect(auth.decoy('Nobody@example.invalid')).toBe(first);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first).not.toBe(auth.decoy('other@example.invalid'));
  });

  it('enforces per-IP and per-email start ceilings and single-use flow binding', () => {
    const auth = make({ value: 1_000 });
    const context = auth.createContext('127.0.0.1');
    const started = auth.begin({ cookie: context.cookie, nonce: context.nonce, ip: '127.0.0.1', email: 'guest@example.invalid', actor: null });
    const flow = 'F'.repeat(43); auth.bindFlow(context.cookie, flow);
    expect(auth.take(context.cookie, flow)).toEqual({ actor: null, subject: started.subject });
    expect(() => auth.take(context.cookie, flow)).toThrow('BOOTSTRAP_REAUTH_CLOSED');

    for (let index = 0; index < 5; index++) {
      const next = auth.createContext('10.0.0.1');
      auth.begin({ cookie: next.cookie, nonce: next.nonce, ip: '10.0.0.1', email: `limited${index}@example.invalid`, actor: null });
    }
    const limited = auth.createContext('10.0.0.1');
    expect(() => auth.begin({ cookie: limited.cookie, nonce: limited.nonce, ip: '10.0.0.1', email: 'sixth@example.invalid', actor: null })).toThrow('BOOTSTRAP_REAUTH_RATE_LIMITED');

    for (let index = 0; index < 3; index++) {
      const next = auth.createContext('10.0.0.2');
      auth.begin({ cookie: next.cookie, nonce: next.nonce, ip: '10.0.0.2', email: 'same@example.invalid', actor: null });
    }
    const emailLimited = auth.createContext('10.0.0.2');
    expect(() => auth.begin({ cookie: emailLimited.cookie, nonce: emailLimited.nonce, ip: '10.0.0.2', email: 'same@example.invalid', actor: null })).toThrow('BOOTSTRAP_REAUTH_RATE_LIMITED');
  });
});
