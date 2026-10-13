import { createHash } from 'node:crypto';
import { UUID } from '@dossiercle/contracts';
import { nativeTransport } from './native-transport.js';
import type { TransportOptions } from './keycloak-adapter.js';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_NATIVE_RESPONSE');
  return value as Record<string, unknown>;
}
/** Reads native state only; never creates a token, computes OTP or accepts a client proof. */
export class EnrollmentAdapter {
  private readonly transport;
  constructor(private readonly options: { transport: TransportOptions; verifierPassword: string }) {
    this.transport = nativeTransport(options.transport);
  }
  async proof(subject: string, technicalUsername: string) {
    UUID.parse(subject); UUID.parse(technicalUsername);
    const authResponse = await this.transport(this.options.transport.advertisedOrigin + '/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 's01-verifier', password: this.options.verifierPassword }),
    });
    const auth = await this.result(authResponse); const token = auth['token'];
    if (typeof token !== 'string' || auth['role'] !== 'admin') throw new Error('INVALID_NATIVE_RESPONSE');
    const filter = new URLSearchParams({ user: technicalUsername, userid: subject, realm: 'dossiercle',
      resolver: 's01-keycloak', type: 'totp', pagesize: '2' });
    const response = await this.transport(this.options.transport.advertisedOrigin + '/token/?' + filter, {
      headers: { 'PI-Authorization': token },
    });
    const value = await this.result(response);
    if (value['count'] !== 1 || !Array.isArray(value['tokens']) || value['tokens'].length !== 1) throw new Error('IDENTITY_NOT_READY');
    const native = object(value['tokens'][0]);
    if (native['tokentype'] !== 'totp' || native['user_id'] !== subject || native['resolver'] !== 's01-keycloak'
      || !Array.isArray(native['realms']) || !native['realms'].includes('dossiercle')
      || native['rollout_state'] !== 'enrolled' || native['active'] !== true
      || native['revoked'] !== false || native['locked'] !== false || typeof native['serial'] !== 'string') {
      throw new Error('IDENTITY_NOT_READY');
    }
    const info=object(native['info']);
    if(native['otplen']!==6||String(info['timeStep'])!=='30'||String(info['timeWindow'])!=='60'||info['hashlib']!=='sha1')throw new Error('IDENTITY_NOT_READY');
    return { enrollmentVerified: true as const, fingerprint: createHash('sha256')
      .update(JSON.stringify({ serial: native['serial'], subject, resolver: 's01-keycloak', realm: 'dossiercle', state: 'enrolled', otplen:6,hashlib:'sha1',timeStep:30,timeWindow:60 })).digest('hex') };
  }
  private async result(response: Response) {
    if (!response.ok) throw new Error('DEPENDENCY_UNAVAILABLE');
    const result = object(object(await response.json())['result']);
    if (result['status'] !== true) throw new Error('DEPENDENCY_UNAVAILABLE');
    return object(result['value']);
  }
}
