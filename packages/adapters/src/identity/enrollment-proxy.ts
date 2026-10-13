import { EnrollmentClosed, type EnrollmentCoordinator } from './enrollment-coordinator.js';
import { nativeTransport } from './native-transport.js';
/** Fixed native UI/API facade. Native software owns authentication and token verification. */
export class EnrollmentProxy {
  private readonly transport;
  private readonly staticTransport;
  constructor(private readonly coordinator:EnrollmentCoordinator,private readonly options:Parameters<typeof nativeTransport>[0]){this.transport=nativeTransport(options);this.staticTransport=nativeTransport({...options,responseLimitBytes:2*1024*1024});}
  async request(input:{cookie:string;method:string;path:string;origin?:string;jwt?:string;contentType?:string;body?:string}):Promise<Response>{
    if(!input.path.startsWith('/')||/%|\\|\/\/|(?:^|\/)\.\.?(?:\/|$)/.test(input.path.split('?')[0]!))throw new EnrollmentClosed();
    const url=new URL(input.path,this.options.advertisedOrigin);
    if(url.origin!==this.options.advertisedOrigin||url.hash||url.username||url.password||/%|\\|\/\/|\.\./.test(url.pathname))throw new EnrollmentClosed();
    const mutation=input.method==='POST',mint=mutation&&url.pathname==='/auth';
    if(mutation&&url.search)throw new EnrollmentClosed();
    const allowedQueries=url.pathname==='/token/'?['page','pagesize','sortby','sortdir','serial','user','realm','type']:url.pathname==='/user/'?['user','realm','page','pagesize']:url.pathname.startsWith('/static/')?['v']:[];
    for(const key of url.searchParams.keys())if(!allowedQueries.includes(key)||url.searchParams.getAll(key).length!==1)throw new EnrollmentClosed();
    const staticRead=input.method==='GET'&&(url.pathname==='/'||/^\/static\/[A-Za-z0-9_./-]+$/.test(url.pathname));
    const apiRead=input.method==='GET'&&['/token/','/user/','/auth/rights'].includes(url.pathname);
    if(!(staticRead||apiRead||mint||(mutation&&url.pathname==='/token/init')))throw new EnrollmentClosed();
    if(apiRead&&!input.jwt)throw new EnrollmentClosed();
    if(mutation&&(!input.contentType||!/^application\/json(?:;\s*charset=UTF-8)?$/i.test(input.contentType)||Buffer.byteLength(input.body??'')>32768))throw new EnrollmentClosed();
    let validated:Record<string,unknown>|undefined;
    if(mutation){
        let parsed:unknown;try{parsed=JSON.parse(input.body??'');}catch{throw new EnrollmentClosed();}
        if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new EnrollmentClosed();
        const data=parsed as Record<string,unknown>;
        if(mint){
          if(Object.keys(data).some(k=>!['username','password','realm','transaction_id'].includes(k))||(data['password']!==undefined&&data['password']!==''))throw new EnrollmentClosed();
        }else {
          if((data['otplen']!==undefined&&data['otplen']!==6)||(data['timeStep']!==undefined&&data['timeStep']!==30)
            ||(data['timeWindow']!==undefined&&data['timeWindow']!==60)||(data['hashlib']!==undefined&&data['hashlib']!=='sha1')
            ||(data['genkey']!==undefined&&data['genkey']!==1&&data['genkey']!==true)||(data['generate']!==undefined&&data['generate']!==true))throw new EnrollmentClosed();
          if((data['radius.system_settings']!==undefined&&data['radius.system_settings']!==true)
            ||(data['container_serial']!==undefined&&data['container_serial']!==null)||(data['2stepinit']!==undefined&&data['2stepinit']!==false))throw new EnrollmentClosed();
          if((data['rollover']!==undefined&&data['rollover']!==false)
            ||(data['validity_period_start']!==undefined&&data['validity_period_start']!=='')
            ||(data['validity_period_end']!==undefined&&data['validity_period_end']!==''))throw new EnrollmentClosed();
          delete data['rollover'];delete data['validity_period_start'];delete data['validity_period_end'];
          delete data['radius.system_settings'];delete data['container_serial'];delete data['2stepinit'];
          if(data['genkey']===true)data['genkey']=1;
          if(data['type']!=='totp'||(data['otpkey']!==undefined&&data['otpkey']!==null&&data['otpkey']!=='')
            ||(data['pin']!==undefined&&data['pin']!==''&&data['pin']!==null)
            ||Object.keys(data).some(k=>!['type','description','generate','genkey','otpkey','pin','user','realm','serial','verify','otplen','hashlib','timeStep','timeWindow','radius.system_settings','container_serial','2stepinit'].includes(k)))throw new EnrollmentClosed();
        }
        if(!mint){
          const serial=data['serial'];
          if(serial!==undefined&&Object.keys(data).some(k=>!['type','serial','verify','user','realm','pin'].includes(k)))throw new EnrollmentClosed();
          if(serial===undefined&&data['genkey']!==1&&data['generate']!==true)throw new EnrollmentClosed();
          if(serial!==undefined&&(typeof serial!=='string'||! /^[A-Za-z0-9_-]{1,128}$/.test(serial)))throw new EnrollmentClosed();
        }
      validated=data;
    }
    return await this.coordinator.withGrant(input.cookie,{mutation,...(input.origin?{origin:input.origin}:{}),...(input.jwt?{nativeJwt:input.jwt}:{}),...(mint?{mintJwt:true}:{})},async(grant,lease)=>{
      const headers:Record<string,string>={'X-S01-Native-User':grant.subject+'@dossiercle'};
      if(input.jwt)headers['PI-Authorization']=input.jwt;
      let body=input.body;
      if(mutation){
        const data={...validated!};
        // Native UI may send the same identity; never allow it to choose another one.
        if(data['user']!==undefined&&data['user']!==grant.subject&&data['user']!=='')throw new EnrollmentClosed();
        if(data['username']!==undefined&&data['username']!==grant.subject&&data['username']!==grant.subject+'@dossiercle')throw new EnrollmentClosed();
        if(data['realm']!==undefined&&data['realm']!==''&&data['realm']!=='dossiercle')throw new EnrollmentClosed();
        if(!mint){
          const serial=data['serial'];
          const filter=new URLSearchParams({user:grant.subject,userid:grant.subject,realm:'dossiercle',resolver:'s01-keycloak',type:'totp',pagesize:'2'});
          if(typeof serial==='string')filter.set('serial',serial);
          await lease.check();
          const listed=await this.transport(this.options.advertisedOrigin+'/token/?'+filter,{headers,signal:lease.signal});
          if(!listed.ok)throw new EnrollmentClosed();
          const list=await listed.json() as {result?:{status?:unknown;value?:{count?:unknown;tokens?:Array<Record<string,unknown>>}}};
          const tokens=list.result?.value;
          if(list.result?.status!==true||!tokens||!Array.isArray(tokens.tokens))throw new EnrollmentClosed();
          if(serial===undefined){if(tokens.count!==0||tokens.tokens.length!==0)throw new EnrollmentClosed();}
          else {
            const own=tokens.tokens[0];
            if(tokens.count!==1||tokens.tokens.length!==1||!own||own['serial']!==serial||own['user_id']!==grant.subject
              ||own['resolver']!=='s01-keycloak'||own['tokentype']!=='totp'||own['rollout_state']!=='verify'
              ||typeof data['verify']!=='string'||! /^[0-9]{6}$/.test(data['verify']))throw new EnrollmentClosed();
          }
          // Empty native PIN fields confer no PIN capability and are omitted.
          if(data['pin']===''||data['pin']===null)delete data['pin'];
        }
        headers['Content-Type']='application/json';body=JSON.stringify(data);
      }
      await lease.check();
      const response=await (staticRead?this.staticTransport:this.transport)(url,{method:input.method,headers,signal:lease.signal,...(body!==undefined?{body}:{})});
      if(!mint)return {value:response};
      if(!response.ok)throw new EnrollmentClosed();
      const data=await response.clone().json() as {result?:{status?:unknown;value?:{token?:unknown;role?:unknown;username?:unknown;realm?:unknown}}};
      const native=data.result?.value;
      if(data.result?.status!==true||native?.role!=='user'||native.username!==grant.subject||native.realm!=='dossiercle'||typeof native.token!=='string')throw new EnrollmentClosed();
      return {value:response,mintedJwt:native.token};
    });
  }
}
