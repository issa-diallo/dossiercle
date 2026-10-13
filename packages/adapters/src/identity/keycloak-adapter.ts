import { createHash } from 'node:crypto';
import * as oidc from 'openid-client';
import { decodeJwt, decodeProtectedHeader } from 'jose';
import { UUID, Email } from '@dossiercle/contracts';
import { nativeSid } from './native-sid.js';
import { nativeTransport } from './native-transport.js';

export class NativeIdentityMismatch extends Error {
  constructor() { super('NATIVE_IDENTITY_MISMATCH'); }
}
const Subject = UUID;
export type NativeUser = { id: string; username: string; enabled: boolean; contact: string; invitationRoot: string };
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_NATIVE_RESPONSE');
  return value as Record<string, unknown>;
}
function parseUser(value: unknown): NativeUser {
  const user = record(value);
  if (typeof user['enabled'] !== 'boolean') throw new Error('INVALID_NATIVE_RESPONSE');
  const attributes=user['attributes'];
  if(!attributes||typeof attributes!=='object'||Array.isArray(attributes))throw new NativeIdentityMismatch();
  const root = record(attributes)['s01.invitation.root'];
  if (!Array.isArray(root) || root.length !== 1) throw new NativeIdentityMismatch();
  if(!UUID.safeParse(user['id']).success||!UUID.safeParse(user['username']).success||!Email.safeParse(user['email']).success||!UUID.safeParse(root[0]).success)throw new NativeIdentityMismatch();
  return { id: UUID.parse(user['id']), username: UUID.parse(user['username']), enabled: user['enabled'],
    contact: Email.parse(user['email']), invitationRoot: UUID.parse(root[0]) };
}
function parseUsers(value: unknown): NativeUser[] {
  if (!Array.isArray(value)) throw new Error('INVALID_NATIVE_RESPONSE');
  return value.map(parseUser);
}
export type TransportOptions = Parameters<typeof nativeTransport>[0];

export class KeycloakAdapter {
  private readonly transport;
  private readonly issuer: URL;
  constructor(private readonly options: {
    transport: TransportOptions; realm: string; clientId: string; clientSecret: string;
    callbackOrigin: string;
    administrativeClientId: string; administrativeSecret: string;
    importClientId?: string; importSecret?: string;
  }) {
    if (options.realm !== 'dossiercle') throw new Error('UNKNOWN_REALM');
    this.transport = nativeTransport(options.transport);
    this.issuer = new URL('/realms/' + options.realm, options.transport.advertisedOrigin);
  }
  async oidcConfiguration() {
    return await oidc.discovery(this.issuer, this.options.clientId,
      { client_secret: this.options.clientSecret }, oidc.ClientSecretPost(this.options.clientSecret), {
        [oidc.customFetch]: this.transport, execute: [oidc.enableNonRepudiationChecks],
      });
  }
  async begin(redirectUri: string,subject?:string) {
    this.checkRedirect(redirectUri);
    const configuration = await this.oidcConfiguration();
    const verifier = oidc.randomPKCECodeVerifier();
    const state = oidc.randomState(); const nonce = oidc.randomNonce();
    const url = oidc.buildAuthorizationUrl(configuration, {
      redirect_uri: redirectUri, scope: 'openid', ...(subject?{login_hint:UUID.parse(subject)}:{}), code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
      code_challenge_method: 'S256', state, nonce, acr_values: '2', prompt: 'login',
    });
    return { url, verifier, state, nonce };
  }
  async exchange(url: URL, expected: { verifier: string; state: string; nonce: string }) {
    this.checkRedirect(url.origin + url.pathname);
    const configuration = await this.oidcConfiguration();
    const tokens = await oidc.authorizationCodeGrant(configuration, url, {
      pkceCodeVerifier: expected.verifier, expectedState: expected.state, expectedNonce: expected.nonce,
      idTokenExpected: true,
    });
    const claims = tokens.claims();
    if(!claims)throw new Error('NATIVE_CLAIMS_ABSENT');
    if(claims['acr']!=='2')throw new Error('NATIVE_ACR_NOT_STRONG');
    if(claims.iss!==this.issuer.href)throw new Error('NATIVE_ISSUER_MISMATCH');
    const subject = Subject.parse(claims.sub);
    // Tokens never returned to a browser; caller must encrypt before persistence.
    return { subject, tokens, sid: nativeSid(claims['sid']), acr: claims['acr'], issuer: claims.iss };
  }
  /** Maintained refresh grant, only for an explicitly authorized human mutation. */
  async refreshSession(subject:string,payload:Record<string,unknown>):Promise<Record<string,unknown>> {
    nativeSid(payload['sid']);
    const previous=record(payload['tokens']);
    if(typeof previous['refresh_token']!=='string'||!previous['refresh_token'])throw new Error('IDENTITY_NOT_READY');
    const configuration=await this.oidcConfiguration();
    const tokens=await oidc.refreshTokenGrant(configuration,previous['refresh_token']);
    const claims=tokens.claims();
    if(!claims||claims.sub!==UUID.parse(subject)||claims.iss!==this.issuer.href||claims['acr']!=='2'||claims['sid']!==payload['sid'])throw new Error('IDENTITY_NOT_READY');
    return {...payload,tokens:{...tokens,refresh_token:tokens.refresh_token??previous['refresh_token']}};
  }
  private checkRedirect(uri: string) {
    if (!/^https:\/\/localhost:[0-9]+$/.test(this.options.callbackOrigin)
      || uri !== this.options.callbackOrigin + '/v1/auth/oidc/callback') throw new Error('INVALID_REDIRECT');
  }
  private async admin(method: string, path: string, body?: unknown, importing = false) {
    const clientId = importing ? this.options.importClientId : this.options.administrativeClientId;
    const secret = importing ? this.options.importSecret : this.options.administrativeSecret;
    if (!clientId || !secret) throw new Error('IDENTITY_NOT_READY');
    const auth = await this.transport(new URL('/realms/dossiercle/protocol/openid-connect/token', this.issuer), {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: secret }),
    });
    if (!auth.ok) throw new Error('DEPENDENCY_UNAVAILABLE');
    const token = record(await auth.json())['access_token'];
    if (typeof token !== 'string' || !token) throw new Error('INVALID_NATIVE_RESPONSE');
    const init: { method: string; headers: Record<string, string>; body?: string } = { method, headers: { Authorization: 'Bearer ' + token } };
    if (body !== undefined) {
      init.body = JSON.stringify(body); init.headers = { ...init.headers, 'Content-Type': 'application/json' };
    }
    const response = await this.transport(new URL('/admin/realms/dossiercle' + path, this.issuer), init);
    if(response.status===404&&method==='GET'&&/^\/users\/[0-9a-f-]{36}$/.test(path))throw new NativeIdentityMismatch();
    if (!response.ok) throw new Error('DEPENDENCY_UNAVAILABLE');
    if (response.status === 204) return undefined;
    const text = await response.text();
    if (!text && response.status === 201) return undefined;
    return JSON.parse(text) as unknown;
  }
  async user(subject: string): Promise<NativeUser> {
    return parseUser(await this.admin('GET', '/users/' + Subject.parse(subject)));
  }
  /** Identity coordinator only, after durable J1 PENDING for the reserved subject. */
  async createUser(subject: string, technicalUsername: string, contact: string, invitationRoot: string): Promise<NativeUser> {
    Subject.parse(subject); Subject.parse(technicalUsername); contact = Email.parse(contact); Subject.parse(invitationRoot);
    const path = '/users?username=' + technicalUsername + '&exact=true&briefRepresentation=false';
    let users = parseUsers(await this.admin('GET', path));
    if (users.length === 0) {
      await this.admin('POST', '/partialImport', { ifResourceExists: 'FAIL', users: [{ id: subject,
        username: technicalUsername, email: contact, enabled: true,
        emailVerified: false, attributes: { 's01.invitation.root': [invitationRoot] },
        requiredActions: ['UPDATE_PASSWORD', 'CONFIGURE_RECOVERY_AUTHN_CODES'] }] }, true);
      users = parseUsers(await this.admin('GET', path));
    }
    if (users.length !== 1 || users[0]?.username !== technicalUsername || !users[0].enabled
      || users[0].id !== subject || users[0].contact !== contact || users[0].invitationRoot !== invitationRoot) throw new Error('IDENTITY_NOT_READY');
    return users[0];
  }
  async credentialReadiness(subject: string) {
    const raw = await this.admin('GET', '/users/' + Subject.parse(subject) + '/credentials');
    if (!Array.isArray(raw)) throw new Error('INVALID_NATIVE_RESPONSE');
    const credentials = raw.map(value => {
      const item = record(value);
      if (typeof item['type'] !== 'string') throw new Error('INVALID_NATIVE_RESPONSE');
      if(!UUID.safeParse(item['id']).success||typeof item['createdDate']!=='number'||!Number.isSafeInteger(item['createdDate']))throw new Error('INVALID_NATIVE_RESPONSE');
      return { id:item['id'],type:item['type'],createdDate:item['createdDate'] };
    });
    if (credentials.some(value => value.type === 'otp')) throw new NativeIdentityMismatch();
    return { passwordConfigured: credentials.some(value => value.type === 'password'),
      recoveryReady: credentials.some(value => value.type === 'recovery-authn-codes'),
      fingerprint:createHash('sha256').update(JSON.stringify(credentials.sort((a,b)=>String(a.id).localeCompare(String(b.id))))).digest('hex') };
  }
  async sessionPresent(subject: string, sid: string) {
    nativeSid(sid);
    const raw = await this.admin('GET', '/users/' + Subject.parse(subject) + '/sessions');
    if (!Array.isArray(raw)) throw new Error('INVALID_NATIVE_RESPONSE');
    return raw.some(value => {
      const session = record(value);
      return session['id'] === sid && Object.values(record(session['clients'])).includes(this.options.clientId);
    });
  }
  async sendNativeRequiredActions(subject: string) {
    const redirect = this.options.callbackOrigin + '/v1/auth/enrollment/complete';
    const params = new URLSearchParams({ client_id: this.options.clientId, redirect_uri: redirect, lifespan: '600' });
    await this.admin('PUT', '/users/' + Subject.parse(subject) + '/execute-actions-email?' + params,
      ['UPDATE_PASSWORD', 'CONFIGURE_RECOVERY_AUTHN_CODES']);
  }
  /** Restrictive prefilter only. Keycloak verifies the INTERNAL/HS512 signature itself. */
  checkActionTokenClaims(token: string, subject: string) {
    if (token.length > 8192) throw new Error('IDENTITY_NOT_READY');
    if (decodeProtectedHeader(token).alg !== 'HS512') throw new Error('IDENTITY_NOT_READY');
    const payload = decodeJwt(token);
    if (!payload.iat || !payload.exp || payload.exp - payload.iat > 600 || payload.iat > Math.floor(Date.now()/1000)
      || payload.exp <= Math.floor(Date.now()/1000) || payload.iss !== this.issuer.href || payload.aud !== this.issuer.href || !payload.jti
      || payload.sub !== UUID.parse(subject) || payload['typ'] !== 'execute-actions' || payload.azp !== this.options.clientId
      || payload['reduri'] !== this.options.callbackOrigin + '/v1/auth/enrollment/complete'
      || !Array.isArray(payload['rqac']) || payload['rqac'].length !== 2
      || !payload['rqac'].includes('UPDATE_PASSWORD') || !payload['rqac'].includes('CONFIGURE_RECOVERY_AUTHN_CODES')) throw new Error('IDENTITY_NOT_READY');
  }
}
