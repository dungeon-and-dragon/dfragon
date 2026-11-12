import type { ServerBuildInfo } from '@dfragon/lib'
import { type DynamicModule, Module } from '@nestjs/common'
import { API_BUILD_INFO, ApiVersionController } from '../../presentation/http/version/controller.js'

@Module({})
export class VersionModule {
  static register(buildInfo: ServerBuildInfo): DynamicModule {
    return {
      module: VersionModule,
      controllers: [ApiVersionController],
      providers: [{ provide: API_BUILD_INFO, useValue: buildInfo }]
    }
  }
}
