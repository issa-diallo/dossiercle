// Host-only procedure: private key is read in memory, never mounted or printed.
import assert from 'node:assert/strict';
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

assert.equal(process.versions.node, '24.21.0');
assert.equal(spawnSync('python3', ['scripts/s01-worktree-identity-check.py', process.cwd()], { stdio: 'ignore' }).status, 0);
const environment = JSON.parse(await readFile('.local/environment.json', 'utf8'));
const directory = `${environment.private}/owner-signing`;
for (const name of ['private.pem', 'public.pem', 'initialized.json']) {
  const info = await stat(`${directory}/${name}`);
  assert.equal(info.uid, process.getuid()); assert.equal(info.mode & 0o7777, 0o400);
}
const privateKey = createPrivateKey(await readFile(`${directory}/private.pem`));
const publicKey = createPublicKey(await readFile(`${directory}/public.pem`));
assert.equal(privateKey.asymmetricKeyType, 'ed25519');
assert.equal(publicKey.asymmetricKeyType, 'ed25519');
const der = publicKey.export({ format: 'der', type: 'spki' });
assert.deepEqual(createPublicKey(privateKey).export({ format: 'der', type: 'spki' }), der);
assert.equal(createHash('sha256').update(der).digest('hex'), environment.ownerConfirmationKeyFingerprint);
const payload = Buffer.from('S01 synthetic owner OpenSSL key / Node24 signature interoperability');
const signature = sign(null, payload, privateKey);
assert.equal(verify(null, payload, publicKey, signature), true);
assert.equal(verify(null, Buffer.from('altered synthetic payload'), publicKey, signature), false);
const config = JSON.parse(await readFile(`${environment.private}/coordinator/config.json`, 'utf8'));
assert.equal(config.ownerConfirmationPublicKeyFile, '/run/s01-owner-public.pem');
assert.equal(config.ownerConfirmationKeyFingerprint, environment.ownerConfirmationKeyFingerprint);
console.log(JSON.stringify({ node: process.versions.node, opensslEd25519KeyNodeSignature: 'PASS',
  fingerprintMatches: true, privateKeyPrintedOrMounted: false }));
