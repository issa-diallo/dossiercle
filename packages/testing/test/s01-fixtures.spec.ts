import { describe, expect, it, vi } from 'vitest';
import { safeSyntheticResponse } from '../src/s01-fixtures.js';

const sentinel = 'PRIVATE_REQUEST_SENTINEL';
function expectSafeFailure(error: unknown) {
  expect(error).toBeInstanceOf(Error);
  const failure = error as Error;
  expect(failure.message).toBe('SYNTHETIC_RESPONSE_UNAVAILABLE');
  expect(Object.hasOwn(failure, 'cause')).toBe(false);
  expect(Reflect.ownKeys(failure).every(key => key === 'message' || key === 'stack')).toBe(true);
  expect([failure.message, failure.stack, JSON.stringify(failure)].join('\n')).not.toContain(sentinel);
}

describe('synthetic response diagnostic boundary', () => {
  it('calls once and preserves the exact successful response object', async () => {
    const response = { status: () => 200, json: async () => ({ state: 'ACTIVE' }) };
    const read = vi.fn(async () => response);
    expect(await safeSyntheticResponse(read)).toBe(response);
    expect(read).toHaveBeenCalledOnce();
  });
  it('replaces a synchronous request error without retaining headers, cause or original stack', async () => {
    const original = Object.assign(new Error(sentinel, { cause: new Error(sentinel) }), { headers: { cookie: sentinel } });
    original.stack = sentinel;
    const read = vi.fn((): Promise<never> => { throw original; });
    const failure: unknown = await safeSyntheticResponse(read).catch((error: unknown) => error);
    expectSafeFailure(failure); expect(failure).not.toBe(original); expect(read).toHaveBeenCalledOnce();
  });
  it('replaces an asynchronous rejection with the same safe diagnostic', async () => {
    const read = vi.fn(async () => { throw new Error(sentinel, { cause: { cookie: sentinel } }); });
    expectSafeFailure(await safeSyntheticResponse(read).catch((error: unknown) => error));
    expect(read).toHaveBeenCalledOnce();
  });
  it('does not serialize or inspect rejected non-Error objects', async () => {
    let inspections = 0;
    const hostile = Object.create(null) as Record<string, unknown>;
    for (const key of ['message', 'stack', 'cause', 'headers', 'toString', 'toJSON']) {
      Object.defineProperty(hostile, key, { get() { inspections += 1; throw new Error(sentinel); } });
    }
    const read = vi.fn(async () => { throw hostile; });
    expectSafeFailure(await safeSyntheticResponse(read).catch((error: unknown) => error));
    expect(inspections).toBe(0); expect(read).toHaveBeenCalledOnce();
  });
  it('does not publish rejected primitive values', async () => {
    const read = vi.fn(async () => { throw sentinel; });
    expectSafeFailure(await safeSyntheticResponse(read).catch((error: unknown) => error));
    expect(read).toHaveBeenCalledOnce();
  });
});
