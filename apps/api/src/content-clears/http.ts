import { Controller, Get, Inject, Param, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { CharacterDetailFailure } from '../characters/details/errors.js'
import { ApiClearContentStats, ApiClearStats } from '../presentation/openapi/content-clears.js'
import type { ClearContentStats, ClearStats, ClearStatsService } from './stats.js'

export const CLEAR_STATS_SERVICE = Symbol('CLEAR_STATS_SERVICE')

const contentStatsQuery = z.object({ week: z.iso.date().optional() })

@ApiTags('캐릭터')
@Controller()
export class ClearStatsController {
  constructor(@Inject(CLEAR_STATS_SERVICE) private readonly service: ClearStatsService) {}

  @Get('stats/clears')
  @ApiClearStats()
  stats(): Promise<ClearStats> {
    return this.service.stats()
  }

  @Get('stats/clears/:contentId')
  @ApiClearContentStats()
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
