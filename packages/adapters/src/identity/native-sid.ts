import { createHash } from 'node:crypto';

/** Qualified Keycloak 26.8 alphabet; OIDC itself defines SID as opaque. */
export function nativeSid(value:unknown):string {
  if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(value))throw new Error('INVALID_NATIVE_SESSION');
  return value;
}
/** Domain/issuer separation; native SID is persisted only in encrypted payload. */
export function nativeSidKey(issuer:string,value:unknown):string {
  const digest=createHash('sha256').update(JSON.stringify(['s01.native-sid',issuer,nativeSid(value)])).digest('hex');
  return `${digest.slice(0,8)}-${digest.slice(8,12)}-4${digest.slice(13,16)}-8${digest.slice(17,20)}-${digest.slice(20,32)}`;
}
