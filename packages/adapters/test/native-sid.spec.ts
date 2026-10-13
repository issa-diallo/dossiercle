import { describe,it,expect } from 'vitest';
import { UUID } from '@dossiercle/contracts';
import { nativeSid,nativeSidKey } from '../src/identity/native-sid.js';
describe('qualified native opaque SID and issuer-bound storage key',()=>{
 it('accepts the native twenty-four-character alphabet without treating it as a subject UUID',()=>{
  const sid='Abcdef0123456789_XYz-abcd';expect(nativeSid(sid)).toBe(sid);expect(UUID.safeParse(sid).success).toBe(false);
  expect(UUID.safeParse(nativeSidKey('https://localhost:49401/realms/dossiercle',sid)).success).toBe(true);
 });
 it('rejects missing, empty, oversized and nonqualified identifiers',()=>{
  for(const value of [null,undefined,1,'','x'.repeat(129),'with space','a/b','a=b','a.b'])expect(()=>nativeSid(value)).toThrow('INVALID_NATIVE_SESSION');
 });
 it('is stable, case sensitive, and separates issuers',()=>{
  const issuer='https://localhost:49401/realms/dossiercle';expect(nativeSidKey(issuer,'Opaque')).toBe(nativeSidKey(issuer,'Opaque'));
  expect(nativeSidKey(issuer,'Opaque')).not.toBe(nativeSidKey(issuer,'opaque'));
  expect(nativeSidKey(issuer,'Opaque')).not.toBe(nativeSidKey(issuer+'/other','Opaque'));
 });
});
