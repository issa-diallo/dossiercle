import { Module, type DynamicModule } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';

@Module({})
export class AppModule {
  static registerAuth(options:Parameters<typeof AuthModule.register>[0]):DynamicModule{
    return {module:AppModule,imports:[AuthModule.register(options)]};
  }
}
