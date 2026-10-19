import { createHash } from 'node:crypto';
import type { EnrollmentCoordinator } from './enrollment-coordinator.js';
import type { KeycloakAdapter, TransportOptions } from './keycloak-adapter.js';
import { nativeTransport } from './native-transport.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const nativeCookieName = /^(?:AUTH_SESSION_ID(?:_LEGACY)?|KEYCLOAK_[A-Z_]+|KC_[A-Z_]+)$/;
function cookies(header: string | undefined) {
  const native: string[] = []; const names = new Set<string>(); let session: string | undefined;
  for (const entry of (header ?? '').split(';').map(value => value.trim()).filter(Boolean)) {
    const index = entry.indexOf('='); const name = entry.slice(0, index);
    if (index < 1 || !nativeCookieName.test(name)) continue;
    if (names.has(name)) throw new Error('INVITATION_UNAVAILABLE');
    names.add(name); native.push(entry);
    if (name === 'AUTH_SESSION_ID') session = entry.slice(index + 1);
  }
  return { header: native.join('; '), session };
}

/** Native Keycloak HTML only; credentials are forwarded opaquely under the current grant/J1 locks. */
export class KeycloakBrowserProxy {
  private readonly transport;
  private readonly authorization = new Map<string, {href:string;expires:number}>();
  private readonly emitted = new Map<string, {urls:Set<string>;expires:number}>();
  private readonly initializedActions = new Map<string,number>();
  private readonly jars=new Map<string,{values:Map<string,string>;expires:number}>();
  private readonly bootstrapAuthorization=new Map<string,{href:string;expires:number}>();
  private readonly bootstrapEmitted=new Map<string,{urls:Set<string>;expires:number}>();
  private readonly bootstrapJars=new Map<string,{values:Map<string,string>;expires:number}>();
  constructor(private readonly options: {
    origin: string; enrollment: EnrollmentCoordinator; keycloak: KeycloakAdapter; transport: TransportOptions;
    bootstrap?:{withNative:<T>(cookie:string,work:(subject:string)=>Promise<T>)=>Promise<T>};
  }) {
    this.transport = nativeTransport({ ...options.transport, browserRedirects: true, responseLimitBytes: 2 * 1024 * 1024 });
  }
  authorize(cookie: string, url: URL) {
    if (url.origin !== this.options.origin || url.pathname !== '/realms/dossiercle/protocol/openid-connect/auth') throw new Error('IDENTITY_NOT_READY');
    this.sweep();if (this.authorization.size >= 100) throw new Error('DEPENDENCY_UNAVAILABLE');
    this.authorization.set(hash(cookie), {href:url.href,expires:Date.now()+600_000});
  }
  authorizeBootstrap(cookie:string,url:URL){
    if(url.origin!==this.options.origin||url.pathname!=='/realms/dossiercle/protocol/openid-connect/auth')throw new Error('IDENTITY_NOT_READY');
    this.sweep();if(this.bootstrapAuthorization.size>=100)throw new Error('DEPENDENCY_UNAVAILABLE');
    this.bootstrapAuthorization.set(hash(cookie),{href:url.href,expires:Date.now()+300_000});
  }
  closeBootstrap(cookie:string){const key=hash(cookie);this.bootstrapAuthorization.delete(key);this.bootstrapEmitted.delete(key);this.bootstrapJars.delete(key);}
  close(cookie:string){const key=hash(cookie);this.authorization.delete(key);this.emitted.delete(key);this.initializedActions.delete(key);this.jars.delete(key);
    this.bootstrapAuthorization.delete(key);this.bootstrapEmitted.delete(key);this.bootstrapJars.delete(key);}
  private sweep(){
    for(const [key,value] of this.authorization)if(value.expires<=Date.now())this.authorization.delete(key);
    for(const [key,value] of this.emitted)if(value.expires<=Date.now())this.emitted.delete(key);
    for(const [key,expires] of this.initializedActions)if(expires<=Date.now())this.initializedActions.delete(key);
    for(const [key,value] of this.jars)if(value.expires<=Date.now())this.jars.delete(key);
    for(const [key,value] of this.bootstrapAuthorization)if(value.expires<=Date.now())this.bootstrapAuthorization.delete(key);
    for(const [key,value] of this.bootstrapEmitted)if(value.expires<=Date.now())this.bootstrapEmitted.delete(key);
    for(const [key,value] of this.bootstrapJars)if(value.expires<=Date.now())this.bootstrapJars.delete(key);
  }
  async request(input: { grantCookie?: string; bootstrapCookie?:string; method: string; path: string; cookie?: string; origin?: string; contentType?: string; body?: string }) {
    const url = new URL(input.path, this.options.origin);
    if (url.origin !== this.options.origin || url.hash || !['GET','POST'].includes(input.method)) throw new Error('INVITATION_UNAVAILABLE');
    if(!input.path.startsWith('/')||/[%\\;]|\/\/|(?:^|\/)\.{1,2}(?:\/|$)/.test(input.path.split('?')[0]!))throw new Error('INVITATION_UNAVAILABLE');
    const publicPath = url.pathname === '/realms/dossiercle/.well-known/openid-configuration'
      || url.pathname === '/realms/dossiercle/protocol/openid-connect/certs' || url.pathname.startsWith('/resources/');
    if (publicPath) {
      if (input.method !== 'GET') throw new Error('INVITATION_UNAVAILABLE');
      return await this.transport(url);
    }
    if(input.bootstrapCookie)return await this.requestBootstrap(input,url);
    if (!input.grantCookie || !/^\/realms\/dossiercle\/(?:protocol\/openid-connect\/auth|login-actions\/(?:action-token|authenticate|required-action|restart))$/.test(url.pathname)
      || /[%\\;]|\/\/|(?:^|\/)\.{1,2}(?:\/|$)/.test(input.path.split('?')[0]!)) throw new Error('INVITATION_UNAVAILABLE');
    const mutation = input.method === 'POST';
    if (mutation && input.origin !== this.options.origin) throw new Error('BROWSER_ORIGIN_MISMATCH');
    if (mutation && input.contentType !== 'application/x-www-form-urlencoded') throw new Error('BROWSER_CONTENT_TYPE_MISMATCH');
    const query = new URLSearchParams(url.search), form = new URLSearchParams(input.body ?? ''); const names = new Set<string>();
    for (const [name] of [...query, ...(mutation ? form : [])]) {
      if (names.has(name)) throw new Error('BROWSER_DUPLICATE_PARAMETER');
      if(mutation && ['scope','id_token_hint'].includes(name.toLowerCase())) throw new Error('BROWSER_FORBIDDEN_PARAMETER');
      names.add(name);
    }
    this.sweep();const grantHash=hash(input.grantCookie);
    if((!this.jars.has(grantHash)&&this.jars.size>=100)||(!this.emitted.has(grantHash)&&this.emitted.size>=100))throw new Error('DEPENDENCY_UNAVAILABLE');
    let native = cookies(input.cookie); let mint = false;
    const jar=this.jars.get(grantHash);
    native.header=jar?[...jar.values].map(([name,value])=>name+'='+value).join('; '):'';
    if (!mutation && url.pathname.endsWith('/protocol/openid-connect/auth')) {
      if (this.authorization.get(grantHash)?.href !== url.href) throw new Error('INVITATION_UNAVAILABLE');
      this.authorization.delete(grantHash); mint = true; native = { header: '', session: undefined };
    }
    const actionToken = !mutation && url.pathname.endsWith('/login-actions/action-token') ? query.get('key') : null;
    if (actionToken&&!this.initializedActions.has(grantHash)) {
      mint = true;
      if([...query.keys()].some(name=>!['key','client_id','tab_id'].includes(name)))throw new Error('INVITATION_UNAVAILABLE');
      native = { header: '', session: undefined };
    } else if (!mint) {
      const emitted=this.emitted.get(grantHash);
      if(!emitted?.urls.delete(input.method+':'+url.href))throw new Error('BROWSER_ACTION_NOT_EMITTED');
    }
    if (!mint && !native.session) throw new Error('BROWSER_NATIVE_SESSION_ABSENT');
    if(!mint&&jar?.values.get('AUTH_SESSION_ID')!==native.session)throw new Error('BROWSER_SESSION_NOT_BOUND');
    if(query.has('client_id')&&query.get('client_id')!=='s01-bff')throw new Error('BROWSER_CLIENT_MISMATCH');
    if(query.has('auth_session_id')&&query.get('auth_session_id')!==native.session?.split('.')[0])throw new Error('BROWSER_SESSION_QUERY_MISMATCH');
    if(mutation&&['auth_session_id','client_id','tab_id','session_code','execution'].some(name=>form.has(name)))throw new Error('BROWSER_SESSION_BODY_AMBIGUOUS');
    const result=await this.options.enrollment.withGrant(input.grantCookie, {
      mutation, ...(form.has('username')?{technicalUsername:form.get('username')!}:{}), ...(input.origin ? { origin: input.origin } : {}),
      ...(native.session ? { keycloakSession: native.session } : {}), ...(mint ? { mintKeycloakSession: true } : {}),
    }, async (grant, lease) => {
      if (actionToken) this.options.keycloak.checkActionTokenClaims(actionToken, grant.subject);
      const headers: Record<string, string> = {};
      if (native.header) headers['Cookie'] = native.header;
      if (input.origin) headers['Origin'] = input.origin;
      if (input.contentType) headers['Content-Type'] = input.contentType;
      const response = await this.transport(url, { method: input.method, headers, signal: lease.signal, ...(mutation ? { body: input.body ?? '' } : {}) });
      const setCookies = response.headers.getSetCookie();
      if (setCookies.some(value => !nativeCookieName.test(value.split('=')[0]!))) throw new Error('INVALID_NATIVE_RESPONSE');
      const sessionCookie = setCookies.find(value => value.startsWith('AUTH_SESSION_ID='));
      const session = sessionCookie?.split(';')[0]!.slice('AUTH_SESSION_ID='.length);
      if(mint&&(response.status!==200||!session))throw new Error('IDENTITY_NOT_READY');
      const body=await response.text();const urls=new Set<string>();
      if(response.headers.get('content-type')?.includes('text/html')) {
        for(const match of body.matchAll(/\b(action|href)=["']([^"']+)["']/g)){
          const issued=new URL(match[2]!.replaceAll('&amp;','&'),url);
          if(issued.origin===this.options.origin&&issued.pathname.startsWith('/realms/dossiercle/login-actions/'))urls.add((match[1]==='action'?'POST':'GET')+':'+issued.href);
        }
      }
      const location=response.headers.get('location');if(location){const issued=new URL(location,url);urls.add('GET:'+issued.href);}
      if(urls.size>64)throw new Error('INVALID_NATIVE_RESPONSE');
      const nextCookies=new Map(mint?[]:jar?.values??[]);
      for(const setCookie of setCookies){
        const pair=setCookie.split(';')[0]!,index=pair.indexOf('='),name=pair.slice(0,index),value=pair.slice(index+1);
        if(!value||/;\s*max-age=0(?:;|$)/i.test(setCookie))nextCookies.delete(name);else nextCookies.set(name,value);
      }
      if(nextCookies.size>16)throw new Error('INVALID_NATIVE_RESPONSE');
      return { value: {response:new Response(body||null,{status:response.status,headers:response.headers}),urls,expires:grant.expires,nextCookies}, ...(session ? { mintedKeycloakSession: session } : {}) };
    });
    this.emitted.set(grantHash,{urls:result.urls,expires:result.expires});
    this.jars.set(grantHash,{values:result.nextCookies,expires:result.expires});
    if(actionToken)this.initializedActions.set(grantHash,result.expires);
    return result.response;
  }
  private async requestBootstrap(input:{bootstrapCookie?:string;method:string;path:string;origin?:string;contentType?:string;body?:string},url:URL){
    if(!input.bootstrapCookie||!this.options.bootstrap||!['GET','POST'].includes(input.method)
      ||!/^\/realms\/dossiercle\/(?:protocol\/openid-connect\/auth|login-actions\/(?:authenticate|restart))$/.test(url.pathname))throw new Error('INVITATION_UNAVAILABLE');
    const mutation=input.method==='POST';
    if(mutation&&(input.origin!==this.options.origin||input.contentType!=='application/x-www-form-urlencoded'))throw new Error('BROWSER_ORIGIN_MISMATCH');
    const query=new URLSearchParams(url.search),form=new URLSearchParams(input.body??''),names=new Set<string>();
    for(const [name] of [...query,...(mutation?form:[])]){if(names.has(name))throw new Error('BROWSER_DUPLICATE_PARAMETER');names.add(name);}
    const key=hash(input.bootstrapCookie);this.sweep();
    const jar=this.bootstrapJars.get(key);
    let mint=false;
    if(!mutation&&url.pathname.endsWith('/protocol/openid-connect/auth')){
      if(this.bootstrapAuthorization.get(key)?.href!==url.href)throw new Error('INVITATION_UNAVAILABLE');
      this.bootstrapAuthorization.delete(key);mint=true;
    }else if(!this.bootstrapEmitted.get(key)?.urls.delete(input.method+':'+url.href))throw new Error('BROWSER_ACTION_NOT_EMITTED');
    const nativeHeader=mint?'':[...(jar?.values??[])].map(([name,value])=>name+'='+value).join('; ');
    if(!mint&&(!nativeHeader||!jar?.values.has('AUTH_SESSION_ID')))throw new Error('BROWSER_NATIVE_SESSION_ABSENT');
    const response=await this.options.bootstrap.withNative(input.bootstrapCookie,async()=>await this.transport(url,{method:input.method,
      headers:{...(nativeHeader?{Cookie:nativeHeader}:{}),...(input.origin?{Origin:input.origin}:{}),...(input.contentType?{'Content-Type':input.contentType}:{})},
      ...(mutation?{body:input.body??''}:{})}));
    const setCookies=response.headers.getSetCookie();
    if(setCookies.some(value=>!nativeCookieName.test(value.split('=')[0]!)))throw new Error('INVALID_NATIVE_RESPONSE');
    const sessionCookie=setCookies.find(value=>value.startsWith('AUTH_SESSION_ID='));
    if(mint&&(response.status!==200||!sessionCookie))throw new Error('IDENTITY_NOT_READY');
    const body=await response.text(),urls=new Set<string>();
    if(response.headers.get('content-type')?.includes('text/html'))for(const match of body.matchAll(/\b(action|href)=["']([^"']+)["']/g)){
      const issued=new URL(match[2]!.replaceAll('&amp;','&'),url);
      if(issued.origin===this.options.origin&&/^\/realms\/dossiercle\/login-actions\/(?:authenticate|restart)$/.test(issued.pathname))urls.add((match[1]==='action'?'POST':'GET')+':'+issued.href);
    }
    const location=response.headers.get('location');if(location){const issued=new URL(location,url);if(issued.origin===this.options.origin&&issued.pathname==='/v1/auth/bootstrap/reauth/callback')urls.add('GET:'+issued.href);}
    if(urls.size>64)throw new Error('INVALID_NATIVE_RESPONSE');
    const next=new Map(mint?[]:jar?.values??[]);
    for(const value of setCookies){const pair=value.split(';')[0]!,index=pair.indexOf('='),name=pair.slice(0,index),content=pair.slice(index+1);
      if(!content||/;\s*max-age=0(?:;|$)/i.test(value))next.delete(name);else next.set(name,content);}
    if(next.size>16)throw new Error('INVALID_NATIVE_RESPONSE');
    this.bootstrapEmitted.set(key,{urls,expires:Date.now()+300_000});this.bootstrapJars.set(key,{values:next,expires:Date.now()+300_000});
    return new Response(body||null,{status:response.status,headers:response.headers});
  }
}
