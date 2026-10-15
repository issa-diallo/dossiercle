import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { Pool, type PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { OwnerProofVerifier } from '../src/identity/owner-proof.js';
import { readOwnerConfirmation, storeOwnerConfirmation } from '../src/identity/owner-confirmation.js';

const env = JSON.parse(await readFile('.local/environment.json', 'utf8')) as { root: string; private: string; pgPort: number; syntheticOnly: boolean; ownerConfirmationKeyFingerprint: string };
if (!env.syntheticOnly || env.root !== process.cwd()) throw new Error('SYNTHETIC_REQUIRED');
const pool = new Pool({ host: '127.0.0.1', port: env.pgPort, database: 'control', user: 'control_coordinator',
  password: (await readFile(`${env.private}/pg/control_coordinator`, 'utf8')).trim(), max: 2 });
const config = JSON.parse(await readFile(`${env.private}/coordinator/config.json`, 'utf8')) as { ownerSubject: string };
const privatePem = await readFile(`${env.private}/owner-signing/private.pem`);
const verifier = new OwnerProofVerifier({ publicPem: await readFile(`${env.private}/owner-signing/public.pem`),
  fingerprint: env.ownerConfirmationKeyFingerprint, ownerSubject: config.ownerSubject, syntheticOnly: true });
const input = { ownerSubject: config.ownerSubject, fingerprint: env.ownerConfirmationKeyFingerprint, privatePem,
  email: 'SyntheticProof@example.invalid', provenance: 'synthetic-fixture' as const };
afterAll(async () => { privatePem.fill(0); await pool.end(); });
async function transaction(work: (client: PoolClient) => Promise<void>) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); await work(client); } finally { await client.query('ROLLBACK'); client.release(); }
}

describe('owner confirmation real PG immutable paired records', () => {
  it('runs the private Node24 CLI with stdin and publishes exactly two opaque refs', async () => {
    const email = randomUUID() + '@example.invalid';
    const run = (args: string[], body: string) => new Promise<{ code: number | null; out: string; err: string }>((resolve, reject) => {
      const child = spawn(process.execPath, ['scripts/s01-owner-confirmation.ts', ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
      let out = '', err = '';
      child.stdout.on('data', chunk => { out += String(chunk); });
      child.stderr.on('data', chunk => { err += String(chunk); });
      child.on('error', reject); child.on('exit', code => resolve({ code, out, err }));
      child.stdin.end(body);
    });
    const result = await run(['--synthetic-fixture'], JSON.stringify({ email }));
    expect(result.code).toBe(0); expect(result.err).toBe('');
    const refs = JSON.parse(result.out) as { identityConfirmationRef: string; recoveryChannelRef: string };
    expect(Object.keys(refs).sort()).toEqual(['identityConfirmationRef', 'recoveryChannelRef']);
    expect(result.out).not.toContain(email);
    const client = await pool.connect();
    try { expect((await readOwnerConfirmation(client, { ...refs, email }, verifier)).provenance).toBe('synthetic-fixture'); }
    finally { client.release(); }
    for (const [args, body] of [[[], JSON.stringify({ email })], [['--synthetic-fixture'], `{"email":"${email}","email":"other@example.invalid"}`]] as const) {
      const refused = await run([...args], body);
      expect(refused.code).toBe(1); expect(refused.out).toBe(''); expect(refused.err).toBe('OWNER_CONFIRMATION_CLOSED\n');
    }
  });
  it('stores three minimal signed immutable rows and validates the exact pair/contact', async () => transaction(async client => {
    const proof = await storeOwnerConfirmation(client, input, verifier);
    const refs = { email: input.email, identityConfirmationRef: proof.identityConfirmationRef, recoveryChannelRef: proof.recoveryChannelRef };
    expect(await readOwnerConfirmation(client, refs, verifier)).toEqual(proof);
    const rows = (await client.query('SELECT result FROM control.idempotency_record WHERE resource_id=$1', [proof.rootId])).rows;
    expect(rows).toHaveLength(3);
    expect(JSON.stringify(rows)).not.toContain(input.email);
    await expect(readOwnerConfirmation(client, { ...refs, email: 'other@example.invalid' }, verifier)).rejects.toThrow();
    await expect(readOwnerConfirmation(client, { ...refs, recoveryChannelRef: randomUUID() }, verifier)).rejects.toThrow();
  }));
  it('reconfirms the same native IDs/root, closes old refs and refuses a different contact', async () => transaction(async client => {
    const proof = await storeOwnerConfirmation(client, input, verifier);
    await client.query('SET LOCAL ROLE control_t05');
    await client.query(`INSERT INTO control.agency_invitation(id,root_id,subject_id,contact,owner_id)
      VALUES($1,$2,$3,$4,$5)`, [proof.invitationId, proof.rootId, proof.subjectId, input.email, input.ownerSubject]);
    await client.query('SET LOCAL ROLE control_coordinator');
    const existing = { invitationId: proof.invitationId, rootId: proof.rootId, subjectId: proof.subjectId };
    await expect(storeOwnerConfirmation(client, { ...input, existing, email: 'other@example.invalid' }, verifier)).rejects.toThrow();
    const replacement = await storeOwnerConfirmation(client, { ...input, existing }, verifier);
    expect(replacement).toMatchObject(existing);
    expect(replacement.identityConfirmationRef).not.toBe(proof.identityConfirmationRef);
    await expect(readOwnerConfirmation(client, { ...input, identityConfirmationRef: proof.identityConfirmationRef,
      recoveryChannelRef: proof.recoveryChannelRef }, verifier)).rejects.toThrow();
    expect(await readOwnerConfirmation(client, { email: input.email, identityConfirmationRef: replacement.identityConfirmationRef,
      recoveryChannelRef: replacement.recoveryChannelRef }, verifier)).toEqual(replacement);
  }));
  it('rolls back the first signed row when the paired insertion fails', async () => {
    const client = await pool.connect();
    const before = (await client.query('SELECT count(*) AS n FROM control.idempotency_record')).rows[0].n;
    try {
      await client.query('BEGIN');
      const faulty = new Proxy(client, { get(target, key) {
        if (key === 'query') return async (sql: string, params?: unknown[]) => {
          if (params?.[1] === 'platform.owner-channel.v1') return target.query('SELECT 1/0');
          return target.query(sql, params);
        };
        const value: unknown = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
      } });
      await expect(storeOwnerConfirmation(faulty, input, verifier)).rejects.toMatchObject({ code: '22012' });
      await client.query('ROLLBACK');
      expect((await client.query('SELECT count(*) AS n FROM control.idempotency_record')).rows[0].n).toBe(before);
    } finally { await client.query('ROLLBACK'); client.release(); }
  });
});
