import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { verifyMutation } from './auth.service.js';
import type { AuthorizedRequest } from './authority.guard.js';
export const AUTH_ORIGIN = Symbol('AUTH_ORIGIN');

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(AUTH_ORIGIN) private readonly origin: string) {}
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthorizedRequest>();
    const csrf = request.headers['x-csrf-token'];
    verifyMutation(request.headers.origin, this.origin, typeof csrf === 'string' ? csrf : undefined, request.authSession?.csrfToken ?? '');
    return true;
  }
}
