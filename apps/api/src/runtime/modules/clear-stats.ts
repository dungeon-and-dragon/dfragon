import { type DynamicModule, Module } from '@nestjs/common'
import { CLEAR_STATS_SERVICE, ClearStatsController } from '../../content-clears/http.js'
import {
  type ClearStatsReader,
  createClearStatsService,
  emptyClearStatsReader
} from '../../content-clears/stats.js'

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
