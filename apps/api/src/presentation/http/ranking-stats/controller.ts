import { Hono } from 'hono'
import type { RankingStatsService } from '#application/ranking-stats/index.js'
import { CharacterDetailFailure } from '@dfragon/server-core/domain/character-failure.js'
import { readQuery } from '#presentation/http/request-query.js'
import {
  fameRankingQuery,
  setStatsQuery,
  skillStatsQuery,
  toFameRankingResponse,
  toSetStatsResponse,
  toSkillStatsResponse,
  toStatsResponse
} from './dto.js'

export class RankingStatsController {
  constructor(private readonly service: RankingStatsService) {}

  routes(): Hono {
    const routes = new Hono()

    routes.get('/rankings/fame', async (c) => {
      const filter = fameRankingQuery.safeParse(readQuery(c))

      if (!filter.success) {
        throw new CharacterDetailFailure('query')
      }

      const { cursor, ...rankingFilter } = filter.data
      const page = await this.service.fameRanking(rankingFilter, cursor)

      return c.json(toFameRankingResponse(page))
    })

    routes.get('/stats', async (c) => {
      const snapshot = await this.service.stats()

      return c.json(toStatsResponse(snapshot))
    })

    routes.get('/stats/skills', async (c) => {
      const job = skillStatsQuery.safeParse(readQuery(c))

      if (!job.success) {
        throw new CharacterDetailFailure('query')
      }

      const snapshot = await this.service.skillStats(job.data)

      return c.json(toSkillStatsResponse(snapshot))
    })

    routes.get('/stats/sets', async (c) => {
      const query = setStatsQuery.safeParse(readQuery(c))

      if (!query.success) {
        throw new CharacterDetailFailure('query')
      }

      const adoption = await this.service.setStats(query.data)

      return c.json(toSetStatsResponse(adoption))
    })

    return routes
  }
}
