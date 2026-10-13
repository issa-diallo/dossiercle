import { Module, type DynamicModule } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { IdentityCoordinator } from './identity-coordinator.js';
import { KeycloakBrowserProxy } from '@dossiercle/adapters/identity/keycloak-browser-proxy';
import { AuthorityGuard } from './authority.guard.js';
import { CsrfGuard, AUTH_ORIGIN } from './csrf.guard.js';
import { AuthController } from './auth.controller.js';
import { BackchannelAdapter } from '@dossiercle/adapters/identity/backchannel-adapter';

@Module({})
export class AuthModule {
  static register(options:{auth:AuthService;identity:IdentityCoordinator;browser:KeycloakBrowserProxy;origin:string;backchannel:BackchannelAdapter}):DynamicModule{
    return {module:AuthModule,controllers:[AuthController],providers:[AuthorityGuard,CsrfGuard,
      {provide:AuthService,useValue:options.auth},{provide:IdentityCoordinator,useValue:options.identity},
      {provide:KeycloakBrowserProxy,useValue:options.browser},{provide:AUTH_ORIGIN,useValue:options.origin},{provide:BackchannelAdapter,useValue:options.backchannel}],exports:[AuthService]};
  }
}
