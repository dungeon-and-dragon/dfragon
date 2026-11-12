import { type DynamicModule, Module } from '@nestjs/common'
import type { ClearStatsService } from '../../application/content-clears/service.js'
import {
  CLEAR_STATS_SERVICE,
  ClearStatsController
} from '../../presentation/http/content-clears/controller.js'

@Module({})
export class ClearStatsModule {
  static register(service: ClearStatsService): DynamicModule {
    return {
      module: ClearStatsModule,
      controllers: [ClearStatsController],
      providers: [{ provide: CLEAR_STATS_SERVICE, useValue: service }]
    }
  }
}
