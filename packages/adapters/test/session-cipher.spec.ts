import { describe, expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { SessionCipher } from '../src/identity/session-cipher.js';
const context={cookieHash:'a'.repeat(64),subjectId:randomUUID(),epoch:1n};
describe('server-side OIDC encryption and CSRF binding',()=>{
 it('roundtrips only with the matching subject/cookie/epoch and preserves no clear token',()=>{
  const cipher=new SessionCipher(randomBytes(32),randomBytes(32));
  const payload='SYNTHETIC_OIDC_TOKEN';const envelope=cipher.encrypt(payload,context);
  expect(envelope.includes(payload)).toBe(false);expect(cipher.decrypt(envelope,context)===payload).toBe(true);
  for(const changed of [{...context,epoch:2n},{...context,subjectId:randomUUID()},{...context,cookieHash:'b'.repeat(64)}])expect(()=>cipher.decrypt(envelope,changed)).toThrow('SESSION_UNAVAILABLE');
 });
 it('closes on absent/wrong keys, tampering, malformed or oversized envelopes',()=>{
  const key=randomBytes(32),csrfKey=randomBytes(32),cipher=new SessionCipher(key,csrfKey);
  const envelope=cipher.encrypt('SYNTHETIC_OIDC_TOKEN',context);
  expect(()=>new SessionCipher(Buffer.alloc(0),csrfKey)).toThrow('SESSION_KEYS_UNAVAILABLE');
  expect(()=>new SessionCipher(randomBytes(32),csrfKey).decrypt(envelope,context)).toThrow('SESSION_UNAVAILABLE');
  for(const invalid of ['',envelope+'.extra',envelope.slice(0,-1)+'!', 'a'.repeat(90001)])expect(()=>cipher.decrypt(invalid,context)).toThrow('SESSION_UNAVAILABLE');
  expect(()=>cipher.encrypt('a'.repeat(65537),context)).toThrow('SESSION_PAYLOAD_TOO_LARGE');
 });
 it('creates a fixed length server CSRF value bound to current session and epoch',()=>{
  const cipher=new SessionCipher(randomBytes(32),randomBytes(32));const csrf=cipher.csrf(context);
  expect(/^[A-Za-z0-9_-]{43}$/.test(csrf)).toBe(true);expect(cipher.csrf(context)===csrf).toBe(true);
  expect(cipher.csrf({...context,epoch:2n})===csrf).toBe(false);
 });
});
