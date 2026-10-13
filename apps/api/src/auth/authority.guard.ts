import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Session } from '@dossiercle/contracts';
import { AuthService } from './auth.service.js';
export type AuthorizedRequest = Request & { authSession?: Session };

@Injectable()
export class AuthorityGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthorizedRequest>();
    request.authSession = await this.auth.session(request.headers.cookie);
    return true;
  }
}
