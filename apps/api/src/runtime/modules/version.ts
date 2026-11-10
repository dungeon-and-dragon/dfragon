import { type DynamicModule, Module } from '@nestjs/common'
import { API_BUILD_INFO, ApiVersionController, readApiBuildInfo } from '../../build-info.js'

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
