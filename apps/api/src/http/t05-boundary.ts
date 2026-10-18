import { createHash,randomUUID } from 'node:crypto';
import type { Request,Response } from 'express';
import { ErrorCode } from '@dossiercle/contracts';
import { opaqueCookie } from '../auth/auth.service.js';
import { T05RateLimiter,T05RequestClosed,t05Header,t05MutationHeaders } from './t05-request.js';
import type { T05CommandRequest } from '../platform/t05-context.js';
const id='[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const routes:[string,RegExp][]=[
  ['POST',/^\/v1\/platform\/agencies\/invitations$/],
  ['GET',new RegExp('^/v1/platform/agencies/invitations/'+id+'$')],
  ['POST',new RegExp('^/v1/platform/agencies/invitations/'+id+'/(issue|revoke)$')],
  ['POST',/^\/v1\/onboarding\/invitation\/claim$/],['POST',/^\/v1\/agencies$/],
  ['GET',/^\/v1\/onboarding\/agency$/],['GET',new RegExp('^/v1/agencies/'+id+'/activation$')],
  ['POST',new RegExp('^/v1/agencies/'+id+'/activation$')],['POST',new RegExp('^/v1/agencies/'+id+'/provisioning/retry$')],
];
export const isT05Namespace=(url:string)=>/^\/v1\/(?:platform\/|onboarding\/|agencies(?:\/|$|\?))/.test(url);
export const isT05Route=(method:string,url:string)=>routes.some(([verb,pattern])=>verb===method&&pattern.test(url));
/** Bounded local admission, shared across the eight public T05 routes. Keys contain only hashes. */
export class T05HttpBoundary {
  private readonly sessions=new T05RateLimiter(10);
  private readonly ips=new T05RateLimiter(60);
  check(request:Request){
    if(!isT05Route(request.method,request.originalUrl))throw new T05RequestClosed(404);
    t05Header(request,'cookie',false);
    this.ips.take(createHash('sha256').update(request.socket.remoteAddress??'unknown').digest('hex'));
    const cookie=opaqueCookie(request.headers.cookie);
    this.sessions.take(createHash('sha256').update(cookie).digest('hex'));
    if(request.method==='GET'&&(t05Header(request,'transfer-encoding',false)!==undefined
      ||!['0',undefined].includes(t05Header(request,'content-length',false))))throw new T05RequestClosed(400);
  }
  command(request:Request,options:{idempotent:boolean;versioned:boolean}):T05CommandRequest{
    this.check(request);const headers=t05MutationHeaders(request,options);
    return {cookie:request.headers.cookie,origin:headers.origin,csrf:headers.csrf,key:headers.key??randomUUID(),
      ...(headers.version===undefined?{}:{version:headers.version})};
  }
}
export function sendT05Error(error:unknown,response:Response){
  const raw=error instanceof Error&&'code' in error?String(error.code):error instanceof Error?error.message:'';
  const parsed=ErrorCode.safeParse(raw);
  const code=parsed.success?parsed.data:'DEPENDENCY_UNAVAILABLE';
  const status=error instanceof T05RequestClosed?error.status:code==='INVALID_REQUEST'?400:code==='NOT_FOUND'?404
    :code==='FORBIDDEN'||code==='INVITATION_UNAVAILABLE'?403:code==='UNAUTHENTICATED'?401
    :['IDEMPOTENCY_CONFLICT','CREATION_CONFLICT','VERSION_CONFLICT','NOT_READY'].includes(code)?409:code==='RATE_LIMITED'?429:503;
  if(error instanceof T05RequestClosed&&error.retryAfter)response.setHeader('Retry-After',String(error.retryAfter));
  response.setHeader('Cache-Control','no-store');
  response.status(status).json({code,correlationId:randomUUID(),retryable:status===503||status===429});
}
