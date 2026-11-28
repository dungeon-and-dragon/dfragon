import { Hono } from 'hono'
import type { RankingStatsService } from '#application/ranking-stats/index.js'
import { CharacterDetailFailure } from '@dfragon/server-core/domain/character-failure.js'
import { readQuery } from '#presentation/http/request-query.js'
import {
  fameRankingQuery,
  itemStatsQuery,
  setStatsQuery,
  skillStatsQuery,
  toFameRankingResponse,
  toItemStatsResponse,
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

      const { page, ...rankingFilter } = filter.data
      const ranking = await this.service.fameRanking(rankingFilter, page)

      return c.json(toFameRankingResponse(ranking))
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

    routes.get('/stats/items', async (c) => {
      const query = itemStatsQuery.safeParse(readQuery(c))

      if (!query.success) {
        throw new CharacterDetailFailure('query')
      }

      const adoption = await this.service.itemStats(query.data)

      return c.json(toItemStatsResponse(adoption))
    })

    return routes
  }
}
