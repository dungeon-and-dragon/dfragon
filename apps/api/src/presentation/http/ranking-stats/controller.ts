import { Hono } from 'hono'
import type { RankingStatsService } from '../../../application/ranking-stats/service.js'
import { CharacterDetailFailure } from '../../../domain/character-failure.js'
import { readQuery } from '../request-query.js'
import {
  fameRankingQuery,
  skillStatsQuery,
  toFameRankingResponse,
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

      const characters = await this.service.fameRanking(filter.data)

      return c.json(toFameRankingResponse(characters))
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

    return routes
  }
}
