/** Private host procedure. Pipe {email, invitationId?} through stdin; never pass contact in argv. */
import { readFile, lstat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { Email, UUID } from '../packages/contracts/dist/agency.contracts.js';
import { OwnerProofVerifier } from '../packages/adapters/dist/identity/owner-proof.js';
import { storeOwnerConfirmation } from '../packages/adapters/dist/identity/owner-confirmation.js';

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (process.argv.length !== 3 || !['--human-confirmed', '--synthetic-fixture'].includes(mode ?? '') || !process.getuid?.()) throw new Error('PRIVATE_OWNER_PROCEDURE_REQUIRED');
  if (spawnSync('python3', ['scripts/s01-worktree-identity-check.py', process.cwd()], { stdio: 'ignore' }).status !== 0) throw new Error('WORKTREE_IDENTITY_REFUSED');
  const state = JSON.parse(await readFile('.local/environment.json', 'utf8')) as { root: string; private: string; syntheticOnly: boolean; tlsPort: number; pgPort: number; ownerConfirmationKeyFingerprint: string };
  const keyCheck = spawnSync('python3', ['-c', `import json,sys;from pathlib import Path;sys.path.insert(0,'scripts');from s01_owner_key import verify;s=json.loads(Path('.local/environment.json').read_text());verify(Path(s['private']),Path.cwd(),s['ownerConfirmationKeyFingerprint'])`], { stdio: 'ignore' });
  if (keyCheck.status !== 0) throw new Error('OWNER_KEY_UNAVAILABLE');
  const config = JSON.parse(await readFile(`${state.private}/coordinator/config.json`, 'utf8')) as { origin: string; issuer: string; ownerSubject: string; ownerConfirmationKeyFingerprint: string };
  if (state.syntheticOnly !== true || state.root !== process.cwd() || config.origin !== `https://localhost:${state.tlsPort}`
    || config.issuer !== config.origin || config.ownerConfirmationKeyFingerprint !== state.ownerConfirmationKeyFingerprint) throw new Error('OWNER_CONFIG_REFUSED');
  UUID.parse(config.ownerSubject);
  const chunks: Buffer[] = []; let length = 0;
  if (process.stdin.isTTY) throw new Error('PRIVATE_STDIN_REQUIRED');
  for await (const raw of process.stdin) {
    const chunk = Buffer.from(raw as Uint8Array); length += chunk.length;
    if (length > 4096) throw new Error('OWNER_INPUT_REFUSED'); chunks.push(chunk);
  }
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(Buffer.concat(chunks));
  const input: unknown = JSON.parse(text);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('OWNER_INPUT_REFUSED');
  const object = input as Record<string, unknown>, keys = Object.keys(object);
  if (!keys.includes('email') || keys.some(key => !['email', 'invitationId'].includes(key))
    || Object.values(object).some(value => typeof value !== 'string')) throw new Error('OWNER_INPUT_REFUSED');
  // This procedure accepts only a flat string dictionary. Extra string tokens expose duplicate keys.
  const strings = text.match(/"(?:[^"\\\x00-\x1f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"/g) ?? [];
  if (strings.length !== keys.length * 2) throw new Error('OWNER_INPUT_REFUSED');
  const email = Email.parse(object.email), invitation = object.invitationId === undefined ? null : UUID.parse(object.invitationId);
  const privatePath = `${state.private}/owner-signing/private.pem`, info = await lstat(privatePath);
  if (!info.isFile() || info.isSymbolicLink() || info.uid !== process.getuid() || (info.mode & 0o7777) !== 0o400) throw new Error('OWNER_KEY_UNAVAILABLE');
  const privatePem = await readFile(privatePath);
  const verifier = new OwnerProofVerifier({ publicPem: await readFile(`${state.private}/owner-signing/public.pem`),
    fingerprint: state.ownerConfirmationKeyFingerprint, ownerSubject: config.ownerSubject, syntheticOnly: true });
  const { Pool } = createRequire(new URL('../packages/adapters/package.json', import.meta.url))('pg') as typeof import('pg');
  const pool = new Pool({ host: '127.0.0.1', port: state.pgPort, database: 'control', user: 'control_coordinator',
    password: (await readFile(`${state.private}/pg/control_coordinator`, 'utf8')).trim(), max: 1,
    connectionTimeoutMillis: 2000, statement_timeout: 5000 });
  const client = await pool.connect();
  try {
    const row = invitation ? (await client.query<{ id: string; root_id: string; subject_id: string }>(
      'SELECT id,root_id,subject_id FROM control.agency_invitation WHERE id=$1', [invitation])).rows[0] : undefined;
    if (invitation && !row) throw new Error('OWNER_INPUT_REFUSED');
    await client.query('BEGIN');
    const proof = await storeOwnerConfirmation(client, { ownerSubject: config.ownerSubject, fingerprint: state.ownerConfirmationKeyFingerprint,
      privatePem, email, provenance: mode === '--synthetic-fixture' ? 'synthetic-fixture' : 'human',
      ...(row ? { existing: { invitationId: row.id, rootId: row.root_id, subjectId: row.subject_id } } : {}) }, verifier);
    await client.query('COMMIT');
    process.stdout.write(JSON.stringify({ identityConfirmationRef: proof.identityConfirmationRef, recoveryChannelRef: proof.recoveryChannelRef }) + '\n');
  } catch { await client.query('ROLLBACK'); throw new Error('OWNER_CONFIRMATION_CLOSED'); }
  finally { privatePem.fill(0); client.release(); await pool.end(); }
}

try { await main(); } catch { process.stderr.write('OWNER_CONFIRMATION_CLOSED\n'); process.exitCode = 1; }
