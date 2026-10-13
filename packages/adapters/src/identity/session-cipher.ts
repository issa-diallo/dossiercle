import { createCipheriv, createDecipheriv, randomBytes, createHmac } from 'node:crypto';
import { UUID } from '@dossiercle/contracts';
export type SessionBinding = { cookieHash: string; subjectId: string; epoch: bigint };
function binding(value: SessionBinding) {
  UUID.parse(value.subjectId);
  if (!/^[a-f0-9]{64}$/.test(value.cookieHash) || value.epoch < 1n) throw new Error('INVALID_SESSION_BINDING');
  return Buffer.from(JSON.stringify({ cookieHash: value.cookieHash, subjectId: value.subjectId, epoch: value.epoch.toString() }));
}
/** OIDC server storage only. This class never processes a password or OTP. */
export class SessionCipher {
  private readonly encryptionKey: Buffer;
  private readonly csrfKey: Buffer;
  constructor(encryptionKey: Buffer, csrfKey: Buffer) {
    if (encryptionKey.length !== 32 || csrfKey.length !== 32) throw new Error('SESSION_KEYS_UNAVAILABLE');
    this.encryptionKey = Buffer.from(encryptionKey); this.csrfKey = Buffer.from(csrfKey);
  }
  encrypt(payload: string, context: SessionBinding) {
    if (Buffer.byteLength(payload) > 65536) throw new Error('SESSION_PAYLOAD_TOO_LARGE');
    const nonce = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, nonce);
    cipher.setAAD(binding(context));
    const ciphertext = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
    return ['v1', nonce.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
  }
  decrypt(envelope: string, context: SessionBinding): string {
    try {
      if (envelope.length > 90000) throw new Error('OVERSIZED');
      const fields = envelope.split('.');
      if (fields.length !== 4 || fields[0] !== 'v1' || fields.slice(1).some(field => !/^[A-Za-z0-9_-]*$/.test(field))) throw new Error('MALFORMED');
      const nonce = Buffer.from(fields[1]!, 'base64url'); const tag = Buffer.from(fields[2]!, 'base64url');
      if (nonce.length !== 12 || tag.length !== 16) throw new Error('MALFORMED');
      const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, nonce);
      decipher.setAAD(binding(context)); decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(Buffer.from(fields[3]!, 'base64url')), decipher.final()]).toString('utf8');
    } catch { throw new Error('SESSION_UNAVAILABLE'); }
  }
  csrf(context: SessionBinding) { return createHmac('sha256', this.csrfKey).update(binding(context)).digest('base64url'); }
}
