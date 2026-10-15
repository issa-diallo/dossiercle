import { Module,type DynamicModule } from '@nestjs/common';
import { InvitationsController } from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';
import { T05HttpBoundary } from '../http/t05-boundary.js';
@Module({})
export class PlatformModule {
  static register(options:{invitations:InvitationsService;boundary:T05HttpBoundary}):DynamicModule{
    return {module:PlatformModule,controllers:[InvitationsController],providers:[
      {provide:InvitationsService,useValue:options.invitations},{provide:T05HttpBoundary,useValue:options.boundary}]};
  }
}
