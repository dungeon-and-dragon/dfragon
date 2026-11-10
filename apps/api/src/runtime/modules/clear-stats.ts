import { type DynamicModule, Module } from '@nestjs/common'
import {
  CLEAR_STATS_SERVICE,
  ClearStatsController
} from '../../presentation/http/content-clears/controller.js'
import { type ClearStatsReader } from '../../application/content-clears/ports.js'
import {
  createClearStatsService,
  emptyClearStatsReader
} from '../../application/content-clears/service.js'

export interface ClearStatsModuleOptions {
  readonly reader?: ClearStatsReader
}

@Module({})
export class ClearStatsModule {
  static register({ reader = emptyClearStatsReader }: ClearStatsModuleOptions): DynamicModule {
    return {
      module: ClearStatsModule,
      controllers: [ClearStatsController],
      providers: [{ provide: CLEAR_STATS_SERVICE, useValue: createClearStatsService(reader) }]
    }
  }
}
