import { Controller, Get, Inject, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { CharacterDetailFailure } from '../characters/details/errors.js'
import { ApiFameRanking, ApiStats } from '../swagger/operations.js'
import type { FameRanking, RankingStatsService, Stats } from './service.js'

export const RANKING_STATS_SERVICE = Symbol('RANKING_STATS_SERVICE')

const fameRankingQuery = z
  .object({
    jobId: z.string().min(1).optional(),
    jobGrowId: z.string().min(1).optional()
  })
  .refine(({ jobId, jobGrowId }) => jobGrowId === undefined || jobId !== undefined)

@ApiTags('캐릭터')
@Controller()
export class RankingStatsController {
  constructor(@Inject(RANKING_STATS_SERVICE) private readonly service: RankingStatsService) {}

  @Get('rankings/fame')
  @ApiFameRanking()
  fameRanking(@Query() query: unknown): Promise<FameRanking> {
    const filter = fameRankingQuery.safeParse(query)
    if (!filter.success) {
      throw new CharacterDetailFailure('query')
    }

    return this.service.fameRanking(filter.data)
  }

  @Get('stats')
  @ApiStats()
  stats(): Promise<Stats> {
    return this.service.stats()
  }
}
