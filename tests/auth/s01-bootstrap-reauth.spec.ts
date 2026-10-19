import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { origin, nativePage, nativePendingInvitation, enrollNative, reauthenticateNative } from './private-t05-native.js';

test('bootstrap reauth owner completes a fresh native MFA flow and lands on JSON session',async()=>{
  test.setTimeout(300_000);
  const subject=randomUUID(),browser=await nativePage();
  try{
    const invitation=await nativePendingInvitation(subject);
    const initial=await enrollNative(browser.page,invitation,()=>{});
    expect(initial.scope).toBe('platform');expect(initial.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await browser.context.clearCookies({name:'__Host-dossiercle'});
    const session=await reauthenticateNative(browser.page,{subject,contact:invitation.contact,password:initial.password,recoveryCode:initial.reauthRecoveryCode});
    expect(session.scope).toBe('platform');expect(session.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(session.csrfToken).not.toBe(initial.csrfToken);
    expect(browser.page.url()).toBe(origin+'/v1/session');
  }finally{await browser.page.goto('about:blank').catch(()=>{});await browser.context.close();}
});
