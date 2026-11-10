import { type DynamicModule, Module } from '@nestjs/common'
import { readApiBuildInfo } from '../../infrastructure/build-info.js'
import { API_BUILD_INFO, ApiVersionController } from '../../presentation/http/version/controller.js'

export interface VersionModuleOptions {
  readonly buildInfoPath?: string
}

@Module({})
export class VersionModule {
  static register({ buildInfoPath }: VersionModuleOptions): DynamicModule {
    return {
      module: VersionModule,
      controllers: [ApiVersionController],
      providers: [{ provide: API_BUILD_INFO, useFactory: () => readApiBuildInfo(buildInfoPath) }]
    }
  }
}
