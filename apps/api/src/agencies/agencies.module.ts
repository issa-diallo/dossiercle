import { Module,type DynamicModule } from '@nestjs/common';
import { AgenciesService } from './agencies.service.js';
import { AgenciesController } from './agencies.controller.js';
import { T05HttpBoundary } from '../http/t05-boundary.js';
@Module({})
export class AgenciesModule {
  static register(options:{service:AgenciesService;boundary:T05HttpBoundary}):DynamicModule{
    return {module:AgenciesModule,controllers:[AgenciesController],providers:[
      {provide:AgenciesService,useValue:options.service},{provide:T05HttpBoundary,useValue:options.boundary}]};
  }
}
