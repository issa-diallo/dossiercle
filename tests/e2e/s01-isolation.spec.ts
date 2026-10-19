import { expect, test } from '@playwright/test';
import { origin, nativePage, nativePendingInvitation, enrollNative } from '../auth/private-t05-native.js';

test('un identifiant d’agence forgé ne révèle ni état ni infrastructure et ne déclenche aucune mutation', async () => {
  const invitation = await nativePendingInvitation(); const browser = await nativePage(); const writes: string[] = [];
  try {
    await enrollNative(browser.page, invitation, () => {});
    browser.page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/v1/')) writes.push(new URL(request.url()).pathname); });
    const foreignId = '0f8fad5b-d9cb-469f-a165-70867728950e';
    const response = await browser.page.evaluate(async id => fetch(`/v1/agencies/${id}/activation`, { credentials: 'same-origin', cache: 'no-store' }).then(value => value.status), foreignId);
    expect([403, 404]).toContain(response);
    await browser.page.goto(origin + '/app/agencies/' + foreignId + '/activation');
    await expect(browser.page.getByText('Cet espace n’est pas disponible pour cette session.')).toBeVisible();
    await browser.page.reload();
    await expect(browser.page.getByText('Cet espace n’est pas disponible pour cette session.')).toBeVisible();
    expect(writes).toEqual([]);
    const text = await browser.page.locator('body').innerText();
    expect(text).not.toMatch(/postgres|journal|worker|fencing|secret|coordinator/i);
  } finally { await browser.context.close(); }
});
