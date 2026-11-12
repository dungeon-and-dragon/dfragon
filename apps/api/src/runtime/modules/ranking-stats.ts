import { type DynamicModule, Module } from '@nestjs/common'
import type { RankingStatsService } from '../../application/ranking-stats/service.js'
import {
  RANKING_STATS_SERVICE,
  RankingStatsController
} from '../../presentation/http/ranking-stats/controller.js'

@Module({})
export class RankingStatsModule {
  static register(service: RankingStatsService): DynamicModule {
    return {
      module: RankingStatsModule,
      controllers: [RankingStatsController],
      providers: [{ provide: RANKING_STATS_SERVICE, useValue: service }]
    }
  }
}
