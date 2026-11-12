import { Controller, Get, Inject, Query, UseFilters } from '@nestjs/common'
import { z } from 'zod'
import { CharacterDetailFailure } from '../../../domain/character-failure.js'
import { characterFailureResponse } from '../character-failures.js'
import { FailureResponseFilter } from '../failure-response.js'
import { isMaleCrusaderJob } from '../../../domain/male-crusader.js'
import type { FameRanking, SkillStats, Stats } from '../../../domain/ranking-stats/stats.js'
import type { RankingStatsService } from '../../../application/ranking-stats/service.js'

export const RANKING_STATS_SERVICE = Symbol('RANKING_STATS_SERVICE')

const role = z.enum(['dealer', 'buffer']).optional()

const fameRankingQuery = z
  .object({
    jobId: z.string().min(1).optional(),
    jobGrowId: z.string().min(1).optional(),
    role
  })
  .refine(({ jobId, jobGrowId }) => jobGrowId === undefined || jobId !== undefined)
  .refine((query) => query.role === undefined || isMaleCrusaderJob(query))

const skillStatsQuery = z
  .object({
    jobId: z.string().min(1),
    jobGrowId: z.string().min(1),
    role
  })
  .refine((query) => query.role === undefined || isMaleCrusaderJob(query))

@Controller()
@UseFilters(new FailureResponseFilter(characterFailureResponse))
export class RankingStatsController {
  constructor(@Inject(RANKING_STATS_SERVICE) private readonly service: RankingStatsService) {}

  @Get('rankings/fame')
  fameRanking(@Query() query: unknown): Promise<FameRanking> {
    const filter = fameRankingQuery.safeParse(query)
    if (!filter.success) {
      throw new CharacterDetailFailure('query')
    }

    return this.service.fameRanking(filter.data)
  }

  @Get('stats')
  stats(): Promise<Stats> {
    return this.service.stats()
  }

  @Get('stats/skills')
  skillStats(@Query() query: unknown): Promise<SkillStats> {
    const job = skillStatsQuery.safeParse(query)
    if (!job.success) {
      throw new CharacterDetailFailure('query')
    }

    return this.service.skillStats(job.data)
  }
}
