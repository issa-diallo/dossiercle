import { Module, type DynamicModule } from '@nestjs/common';
import { AgenciesModule } from './agencies/agencies.module.js';
import type { AgenciesService } from './agencies/agencies.service.js';
import type { InvitationsService } from './platform/invitations.service.js';
import { T05HttpBoundary } from './http/t05-boundary.js';
import { PlatformModule } from './platform/platform.module.js';
import { AuthModule } from './auth/auth.module.js';

@Module({})
export class AppModule {
  static registerAuth(options:Parameters<typeof AuthModule.register>[0]&{t05?:{invitations:InvitationsService;agencies:AgenciesService}}):DynamicModule{
    const boundary=new T05HttpBoundary();
    return {module:AppModule,imports:[AuthModule.register(options),...(options.t05?[PlatformModule.register({invitations:options.t05.invitations,boundary}),AgenciesModule.register({service:options.t05.agencies,boundary})]:[])]};
  }
}
