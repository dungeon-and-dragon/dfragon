import { Controller, Get, Inject, Param, Query, UseFilters } from '@nestjs/common'
import { z } from 'zod'
import { CharacterDetailFailure } from '../../../domain/character-failure.js'
import { characterFailureResponse } from '../character-failures.js'
import { FailureResponseFilter } from '../failure-response.js'
import type { ClearContentStats, ClearStats } from '../../../domain/content-clears/stats.js'
import type { ClearStatsService } from '../../../application/content-clears/service.js'

export const CLEAR_STATS_SERVICE = Symbol('CLEAR_STATS_SERVICE')

const contentStatsQuery = z.object({ week: z.iso.date().optional() })

@Controller()
@UseFilters(new FailureResponseFilter(characterFailureResponse))
export class ClearStatsController {
  constructor(@Inject(CLEAR_STATS_SERVICE) private readonly service: ClearStatsService) {}

  @Get('stats/clears')
  stats(): Promise<ClearStats> {
    return this.service.stats()
  }

  @Get('stats/clears/:contentId')
  contentStats(
    @Param('contentId') contentId: string,
    @Query() query: unknown
  ): Promise<ClearContentStats> {
    const parsed = contentStatsQuery.safeParse(query)
    if (!parsed.success) {
      throw new CharacterDetailFailure('query')
    }

    return this.service.contentStats(contentId, parsed.data.week)
  }
}
