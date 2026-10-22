import { Controller, Get, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, opaqueCookie, SESSION_COOKIE } from './auth.service.js';
import { IdentityCoordinator } from './identity-coordinator.js';
import { KeycloakBrowserProxy } from '@dossiercle/adapters/identity/keycloak-browser-proxy';
import { AuthorityGuard, type AuthorizedRequest } from './authority.guard.js';
import { CsrfGuard, AUTH_ORIGIN } from './csrf.guard.js';
import { BackchannelAdapter } from '@dossiercle/adapters/identity/backchannel-adapter';
import { BootstrapReauthService } from './bootstrap-reauth.service.js';
import { BootstrapReauthStart } from '@dossiercle/contracts';
const GRANT_COOKIE='__Host-s01-enrollment',FLOW_COOKIE='__Host-s01-oidc';
const REAUTH_COOKIE='__Host-s01-bootstrap-reauth',REAUTH_FLOW_COOKIE='__Host-s01-bootstrap-oidc';
async function emptyBody(request:Request){
  let size=0;for await(const chunk of request){size+=Buffer.byteLength(chunk);if(size)throw new Error('INVALID_LOGOUT');}
}
@Controller()
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth:AuthService,@Inject(IdentityCoordinator) private readonly identity:IdentityCoordinator,
    @Inject(KeycloakBrowserProxy) private readonly browser:KeycloakBrowserProxy,@Inject(AUTH_ORIGIN) private readonly origin:string,
    @Inject(BackchannelAdapter) private readonly backchannel:BackchannelAdapter,@Inject(BootstrapReauthService) private readonly bootstrap:BootstrapReauthService){}
  @Get('/v1/auth/bootstrap/reauth/context')
  bootstrapContext(@Req()request:Request,@Res()response:Response){
    const previous=request.headers.cookie?.split(';').some(part=>part.trim().startsWith(REAUTH_COOKIE+'='))?opaqueCookie(request.headers.cookie,REAUTH_COOKIE):undefined;
    const value=this.bootstrap.context(request.socket.remoteAddress??'unknown',previous);
    response.setHeader('Set-Cookie',`${REAUTH_COOKIE}=${value.cookie}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=300`);
    response.json({csrfNonce:value.nonce});
  }
  @Post('/v1/auth/bootstrap/reauth/start')
  async bootstrapStart(@Req()request:Request,@Res()response:Response){
    if(['origin','content-type','x-s01-bootstrap-csrf'].some(name=>request.rawHeaders.filter((value,index)=>index%2===0&&value.toLowerCase()===name).length!==1))throw new Error('BOOTSTRAP_REAUTH_INVALID');
    if(request.headers.origin!==this.origin||request.headers['sec-fetch-site']&&request.headers['sec-fetch-site']!=='same-origin'
      )throw new Error('FORBIDDEN');
    if(request.headers['content-type']!=='application/json')throw new Error('BOOTSTRAP_REAUTH_INVALID');
    const body=request.body as unknown,raw=(request as Request&{rawBody?:string}).rawBody??'';
    if(!BootstrapReauthStart.safeParse(body).success||!/^\s*\{\s*"email"\s*:\s*"(?:[^"\\]|\\.)*"\s*\}\s*$/.test(raw))throw new Error('BOOTSTRAP_REAUTH_INVALID');
    const cookie=opaqueCookie(request.headers.cookie,REAUTH_COOKIE),nonce=request.headers['x-s01-bootstrap-csrf'];
    if(typeof nonce!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(nonce))throw new Error('BOOTSTRAP_REAUTH_INVALID');
    const started=await this.bootstrap.start({cookie,nonce,ip:request.socket.remoteAddress??'unknown',email:BootstrapReauthStart.parse(body).email});
    response.setHeader('Set-Cookie',`${REAUTH_FLOW_COOKIE}=${started.flowCookie}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=300`);
    response.status(202).json({continueUrl:started.continueUrl});
  }
  @Get('/v1/auth/bootstrap/reauth/continue')
  bootstrapContinue(@Req()request:Request,@Res()response:Response){
    const url=this.bootstrap.continue(opaqueCookie(request.headers.cookie,REAUTH_FLOW_COOKIE));response.redirect(303,url.href);
  }
  @Get('/v1/auth/bootstrap/reauth/callback')
  async bootstrapCallback(@Req()request:Request,@Res()response:Response){
    const cookie=opaqueCookie(request.headers.cookie,REAUTH_COOKIE),flow=opaqueCookie(request.headers.cookie,REAUTH_FLOW_COOKIE);
    const previous=request.headers.cookie?.split(';').some(part=>part.trim().startsWith(SESSION_COOKIE+'='))?opaqueCookie(request.headers.cookie):undefined;
    const session=await this.bootstrap.callback(cookie,flow,new URL(request.originalUrl,this.origin),previous);
    response.setHeader('Set-Cookie',[`${SESSION_COOKIE}=${session}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=1296000`,
      `${REAUTH_COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`,`${REAUTH_FLOW_COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`]);
    response.redirect(303,'/v1/session');
  }
  @Get('/v1/auth/oidc/start')
  async start(@Req()request:Request,@Res()response:Response){
    const cookie=opaqueCookie(request.headers.cookie,GRANT_COOKIE);const started=await this.identity.begin(cookie);this.browser.authorize(cookie,started.url);
    response.setHeader('Set-Cookie',`${FLOW_COOKIE}=${started.cookie}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`);
    response.redirect(303,started.url.href);
  }
  @Get('/v1/auth/oidc/callback')
  async callback(@Req()request:Request,@Res()response:Response){
    const grantCookie=opaqueCookie(request.headers.cookie,GRANT_COOKIE);
    const cookie=await this.identity.callback(grantCookie,opaqueCookie(request.headers.cookie,FLOW_COOKIE),new URL(request.originalUrl,this.origin));
    this.browser.close(grantCookie);
    response.setHeader('Set-Cookie',[`${SESSION_COOKIE}=${cookie}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=1296000`,
      `${FLOW_COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`,`${GRANT_COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`]);
    response.redirect(303,'/v1/session');
  }
  @Get('/v1/session')
  @UseGuards(AuthorityGuard)
  session(@Req()request:AuthorizedRequest){return request.authSession;}
  @Post('/v1/auth/logout')
  @UseGuards(AuthorityGuard,CsrfGuard)
  async logout(@Req()request:Request,@Res()response:Response){
    await emptyBody(request);const csrf=request.headers['x-csrf-token'];
    await this.auth.logout(request.headers.cookie,request.headers.origin,typeof csrf==='string'?csrf:undefined);
    response.setHeader('Set-Cookie',`${SESSION_COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`);response.status(204).end();
  }
  @Post('/v1/auth/backchannel')
  async nativeLogout(@Req()request:Request,@Res()response:Response){
    if(!/^application\/x-www-form-urlencoded(?:;\s*charset=UTF-8)?$/i.test(request.headers['content-type']??''))throw new Error('INVALID_LOGOUT_TOKEN');
    const parts:Buffer[]=[];let size=0;
    for await(const chunk of request){size+=Buffer.byteLength(chunk);if(size>32768)throw new Error('INVALID_LOGOUT_TOKEN');parts.push(Buffer.from(chunk));}
    const body=new URLSearchParams(Buffer.concat(parts).toString('utf8'));
    if([...body.keys()].length!==1||body.getAll('logout_token').length!==1)throw new Error('INVALID_LOGOUT_TOKEN');
    const token=await this.backchannel.verify(body.get('logout_token')!);await this.auth.nativeLogout(token);
    response.status(200).end();
  }
}
