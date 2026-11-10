import { type DynamicModule, Module } from '@nestjs/common'
import {
  RANKING_STATS_SERVICE,
  RankingStatsController
} from '../../presentation/http/ranking-stats/controller.js'
import { type RankingStatsReader } from '../../application/ranking-stats/ports.js'
import {
  createRankingStatsService,
  emptyRankingStatsReader
} from '../../application/ranking-stats/service.js'

export interface RankingStatsModuleOptions {
  readonly reader?: RankingStatsReader
}

@Module({})
export class RankingStatsModule {
  static register({ reader = emptyRankingStatsReader }: RankingStatsModuleOptions): DynamicModule {
    return {
      module: RankingStatsModule,
      controllers: [RankingStatsController],
      providers: [{ provide: RANKING_STATS_SERVICE, useValue: createRankingStatsService(reader) }]
    }
  }
}
