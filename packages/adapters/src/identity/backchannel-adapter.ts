import { createRemoteJWKSet, customFetch, jwtVerify } from 'jose';
import { nativeSid } from './native-sid.js';
import { UUID } from '@dossiercle/contracts';
import { nativeTransport } from './native-transport.js';
/** Signature and standard OIDC logout claims only. Durable replay/epoch effects belong to coordinator. */
export class BackchannelAdapter {
  private readonly issuer:string;
  private readonly keys;
  constructor(private readonly options:{transport:Parameters<typeof nativeTransport>[0];clientId:string;now?:()=>Date}){
    this.issuer=options.transport.advertisedOrigin+'/realms/dossiercle';
    this.keys=createRemoteJWKSet(new URL(this.issuer+'/protocol/openid-connect/certs'),{[customFetch]:nativeTransport(options.transport),timeoutDuration:10000,cooldownDuration:0});
  }
  async verify(token:string):Promise<{subject:string|null;sid:string|null;jti:string;issuedAt:number}> {
    try {
      if(!token||token.length>32768)throw new Error('OVERSIZED');
      const now=this.options.now?.()??new Date();
      const {payload}=await jwtVerify(token,this.keys,{issuer:this.issuer,audience:this.options.clientId,algorithms:['RS256'],currentDate:now,clockTolerance:0});
      const issuedAt=payload.iat;
      if(typeof issuedAt!=='number'||!Number.isSafeInteger(issuedAt)||issuedAt>Math.floor(now.getTime()/1000)||issuedAt<Math.floor(now.getTime()/1000)-300
        ||typeof payload.jti!=='string'||! /^[A-Za-z0-9_-]{1,128}$/.test(payload.jti)||payload['nonce']!==undefined)throw new Error('INVALID_LOGOUT');
      const events=payload['events'];
      if(!events||typeof events!=='object'||Array.isArray(events)||Object.keys(events).length!==1)throw new Error('INVALID_LOGOUT');
      const event=(events as Record<string,unknown>)['http://schemas.openid.net/event/backchannel-logout'];
      if(!event||typeof event!=='object'||Array.isArray(event)||Object.keys(event).length!==0)throw new Error('INVALID_LOGOUT');
      const subject=payload.sub===undefined?null:UUID.parse(payload.sub);
      const sid=payload['sid']===undefined?null:nativeSid(payload['sid']);
      if(!subject&&!sid)throw new Error('INVALID_LOGOUT');
      return {subject,sid,jti:payload.jti,issuedAt};
    }catch{throw new Error('INVALID_LOGOUT_TOKEN');}
  }
}
