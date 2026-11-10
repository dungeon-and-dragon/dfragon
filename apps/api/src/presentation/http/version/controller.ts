import { Controller, Get, Inject } from '@nestjs/common'
import type { ServerBuildInfo } from '@dfragon/lib'

export const API_BUILD_INFO = Symbol('API_BUILD_INFO')

@Controller('version')
export class ApiVersionController {
  constructor(@Inject(API_BUILD_INFO) private readonly buildInfo: ServerBuildInfo) {}

  @Get()
  version(): ServerBuildInfo {
    return this.buildInfo
  }
}
