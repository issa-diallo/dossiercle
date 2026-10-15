import { describe, expect, it } from 'vitest';
import { AuthService, opaqueCookie, verifyMutation, SESSION_COOKIE } from '../src/auth/auth.service.js';
import { SessionCipher } from '@dossiercle/adapters/identity/session-cipher';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
const opaque='A'.repeat(43),csrf='B'.repeat(43),origin='https://127.0.0.1:49401';
describe('BFF cookie and mutation boundaries',()=>{
 it('accepts a single opaque host cookie and rejects missing, malformed and duplicates',()=>{
  expect(opaqueCookie(SESSION_COOKIE+'='+opaque)===opaque).toBe(true);
  for(const header of [undefined,'other=value',SESSION_COOKIE+'=short',SESSION_COOKIE+'='+opaque+'; '+SESSION_COOKIE+'='+opaque])expect(()=>opaqueCookie(header)).toThrow('UNAUTHENTICATED');
 });
 it('requires exact origin and a bound CSRF value',()=>{
  expect(()=>verifyMutation(origin,origin,csrf,csrf)).not.toThrow();
  for(const [sentOrigin,sentCsrf] of [[undefined,csrf],[origin+'.example.invalid',csrf],['http://127.0.0.1:49401',csrf],[origin,undefined],[origin,'C'.repeat(43)],[origin,'short']])expect(()=>verifyMutation(sentOrigin,origin,sentCsrf,csrf)).toThrow('FORBIDDEN');
 });
});
describe('onboarding session revocation',()=>{
 it('allows logout for a confirmed ISSUED invitation and revokes before returning',async()=>{
  const subject=randomUUID(),root=randomUUID(),rawCookie=randomBytes(32).toString('base64url'),cookieHash=createHash('sha256').update(rawCookie).digest('hex');
  const cipher=new SessionCipher(randomBytes(32),randomBytes(32)),epoch=1n,now=new Date();
  let revokedAt:Date|null=null;let updateCount=0;let committed=false;let rolledBack=false;const events:string[]=[];
  let currentRole='control_coordinator';const roleChanges:string[]=[];
  const row=()=>({cookie_hash:cookieHash,subject_id:subject,scope:'onboarding',invitation_root_id:root,agency_id:null,epoch:'1',issued_at:now,last_human_activity_at:now,absolute_expires_at:new Date(now.getTime()+60_000),revoked_at:revokedAt,encrypted_oidc_tokens:cipher.encrypt(JSON.stringify({sid:'00000000-0000-4000-8000-000000000090'}),{cookieHash,subjectId:subject,epoch})});
  const client={query:async(sql:string,values?:unknown[])=>{
   if(sql==='BEGIN')return {rows:[]};
   if(sql==='COMMIT'){committed=true;events.push('COMMIT');return {rows:[]};}
   if(sql==='ROLLBACK'){rolledBack=true;return {rows:[]};}
   if(sql==='SELECT current_user')return {rows:[{current_user:currentRole}]};
   if(sql.startsWith('SET LOCAL ROLE')){currentRole=sql.split(' ').at(-1)!.replaceAll('"','');roleChanges.push(currentRole);return {rows:[]};}
   if(sql.includes("operation_type='identity.sid-revoked'"))return {rows:[],rowCount:0};
   if(sql.includes('FROM control.agency_invitation'))return {rows:[{subject_id:subject,status:'ISSUED',identity_status:'CONFIRMED',expires_at:new Date(now.getTime()+60_000)}]};
   if(sql.includes('FROM identity.session'))return {rows:[row()]};
   if(sql.includes('control.lock_session_scope'))return {rows:[]};
   if(sql.includes('UPDATE identity.session SET revoked_at=')){revokedAt=values?.[1] as Date??now;updateCount++;events.push('REVOKE');return {rows:[]};}
   if(sql.includes('UPDATE identity.session SET last_human_activity_at='))return {rows:[]};
   if(sql.includes('UPDATE identity.account_authority')||sql.includes('INSERT INTO control.audit_event'))return {rows:[]};
   throw new Error('UNEXPECTED_TEST_QUERY');
  },release:()=>{}};
  const pool={query:async()=>({rows:[row()]}),connect:async()=>client};
  const control={withLockedAuthority:async(_client:unknown,_subject:string,_write:boolean,work:(client:unknown,authority:unknown)=>Promise<unknown>)=>work(client,{subjectId:subject,identityEpoch:epoch,confirmedEpoch:epoch,status:'CONFIRMED',journalSequence:1n,journalHash:'a'.repeat(64),enrollmentStatus:'VERIFIED',recoveryReady:true})};
  const journal={append:async(_client:unknown,input:{state:string})=>{events.push(input.state);return {sequence:2n,hash:'b'.repeat(64)};}};
  const service=new AuthService({pool:pool as never,control:control as never,journal:journal as never,cipher,ownerSubject:randomUUID(),origin,now:()=>now,nativeSession:async()=>{}});
  const csrf=cipher.csrf({cookieHash,subjectId:subject,epoch});
  await expect(service.logout(SESSION_COOKIE+'='+rawCookie,origin,'C'.repeat(43))).rejects.toMatchObject({code:'FORBIDDEN'});
  expect(updateCount).toBe(0);expect(rolledBack).toBe(true);rolledBack=false;
  await service.logout(SESSION_COOKIE+'='+rawCookie,origin,csrf);
  expect(updateCount).toBe(1);expect(revokedAt).toEqual(now);expect(committed).toBe(true);
  expect(events).toEqual(['PENDING','REVOKE','CONFIRMED','COMMIT']);
  expect(roleChanges).toEqual(['control_audit','control_coordinator']);expect(currentRole).toBe('control_coordinator');
  await expect(service.session(SESSION_COOKIE+'='+rawCookie)).rejects.toMatchObject({code:'UNAUTHENTICATED'});
 });
});
