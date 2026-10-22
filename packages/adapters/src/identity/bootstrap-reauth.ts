import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Email, UUID } from '@dossiercle/contracts';

const opaque = () => randomBytes(32).toString('base64url');
const WINDOW = 60_000;
const CONTEXT_TTL = 5 * 60_000;
const MAX_CONTEXTS = 100;
const DECOY_DOMAIN = 's01.bootstrap-reauth.decoy.v1';

export type BootstrapActor = { subject: string; root: string; epoch: bigint; scope: 'platform' | 'onboarding'; version: string; tokenHash?: string; admissionReceipt?: string };
type Context = { cookieHash: string; nonceHash: string; emailHash: string; actor: BootstrapActor | null; subject: string; expires: number; state: 'context' | 'lookup' | 'challenge'; flowCookieHash?: string };
type Rate = { starts: number[]; contexts: number[] };

/** Bounded, process-local pre-auth state. It contains no credentials or native tokens. */
export class BootstrapReauth {
  private readonly contexts = new Map<string, Context>();
  private readonly rates = new Map<string, Rate>();
  private readonly now: () => number;
  private readonly key: Buffer;
  constructor(private readonly options: { decoyKey: Buffer; now?: () => number }) {
    if (options.decoyKey.length !== 32) throw new Error('BOOTSTRAP_REAUTH_KEY_UNAVAILABLE');
    this.key = Buffer.from(options.decoyKey);
    this.now = options.now ?? Date.now;
  }
  private digest(value: string) { return createHmac('sha256', this.key).update('s01.bootstrap-reauth.context.v1\0').update(value).digest('hex'); }
  private sweep() {
    const now = this.now();
    for (const [key, value] of this.contexts) if (value.expires <= now) this.contexts.delete(key);
    for (const [key, value] of this.rates) {
      value.starts = value.starts.filter(time => time > now - WINDOW);
      value.contexts = value.contexts.filter(time => time > now - WINDOW);
      if (!value.starts.length && !value.contexts.length) this.rates.delete(key);
    }
  }
  private rate(key: string) { let value = this.rates.get(key); if (!value) { value = { starts: [], contexts: [] }; this.rates.set(key, value); } return value; }
  createContext(ip: string, cookie?: string) {
    this.sweep();
    if (this.contexts.size >= MAX_CONTEXTS) throw new Error('BOOTSTRAP_REAUTH_RATE_LIMITED');
    const address = cookie && /^[A-Za-z0-9_-]{43}$/.test(cookie) ? cookie : opaque();
    const ipRate = this.rate('context-ip:' + this.digest(ip));
    if (ipRate.contexts.length >= 10) throw new Error('BOOTSTRAP_REAUTH_RATE_LIMITED');
    ipRate.contexts.push(this.now());
    const nonce = opaque();
    this.contexts.set(this.digest(address), { cookieHash: this.digest(address), nonceHash: this.digest(nonce), emailHash: '', actor: null, subject: '', expires: this.now() + CONTEXT_TTL, state: 'context' });
    return { cookie: address, nonce, expiresIn: CONTEXT_TTL };
  }
  prepare(input: { cookie: string; nonce: string; ip: string; email: string }) {
    this.sweep();
    const context = this.contexts.get(this.digest(input.cookie));
    if (!context || context.state !== 'context' || context.expires <= this.now() || !this.equal(context.nonceHash, this.digest(input.nonce))) throw new Error('BOOTSTRAP_REAUTH_CLOSED');
    const email = Email.parse(input.email);
    const emailKey = this.digest(email);
    const ipKey = this.digest(input.ip);
    const ipRate = this.rate('ip:' + ipKey), emailRate = this.rate('email:' + emailKey);
    if (ipRate.starts.length >= 5 || emailRate.starts.length >= 3) throw new Error('BOOTSTRAP_REAUTH_RATE_LIMITED');
    ipRate.starts.push(this.now()); emailRate.starts.push(this.now());
    context.emailHash = emailKey;
    context.subject = this.decoy(email);
    context.state = 'lookup';
    context.expires = this.now() + CONTEXT_TTL;
    delete context.flowCookieHash;
    return { email, cookie: input.cookie, expires: context.expires };
  }
  begin(input: { cookie: string; nonce: string; ip: string; email: string; actor: BootstrapActor | null }) {
    const email=Email.parse(input.email),key=this.digest(input.cookie),context=this.contexts.get(key);
    if(context?.state==='context')this.prepare({...input,email});
    const current=this.contexts.get(key);
    if(!current||current.state!=='lookup'||current.expires<=this.now()||!this.equal(current.nonceHash,this.digest(input.nonce))
      ||!this.equal(current.emailHash,this.digest(email)))throw new Error('BOOTSTRAP_REAUTH_CLOSED');
    current.actor=input.actor;
    current.subject=input.actor?.subject??this.decoy(email);
    current.state='challenge';
    return { subject: current.subject, cookie: input.cookie, expires: current.expires };
  }
  bindFlow(cookie: string, flowCookie: string) {
    const context = this.contexts.get(this.digest(cookie));
    if (!context || context.state !== 'challenge' || context.expires <= this.now() || !/^[A-Za-z0-9_-]{43}$/.test(flowCookie)) throw new Error('BOOTSTRAP_REAUTH_CLOSED');
    context.flowCookieHash = this.digest(flowCookie);
  }
  take(cookie: string, flowCookie: string) {
    this.sweep();
    const key = this.digest(cookie), context = this.contexts.get(key);
    if (!context || context.state !== 'challenge' || context.expires <= this.now() || !context.flowCookieHash || !this.equal(context.flowCookieHash, this.digest(flowCookie))) throw new Error('BOOTSTRAP_REAUTH_CLOSED');
    this.contexts.delete(key);
    return { actor: context.actor, subject: context.subject };
  }
  close(cookie: string) { this.contexts.delete(this.digest(cookie)); }
  peek(cookie:string){
    this.sweep();const value=this.contexts.get(this.digest(cookie));
    if(!value||value.state!=='challenge'||value.expires<=this.now())throw new Error('BOOTSTRAP_REAUTH_CLOSED');
    return {actor:value.actor,subject:value.subject};
  }
  decoy(email: string) {
    const bytes = createHmac('sha256', this.key).update(DECOY_DOMAIN).update('\0').update(Email.parse(email)).digest().subarray(0, 16);
    bytes[6] = (bytes[6]! & 0x0f) | 0x50; bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = bytes.toString('hex'); return UUID.parse(`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`);
  }
  private equal(left: string, right: string) { const a = Buffer.from(left), b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }
}
