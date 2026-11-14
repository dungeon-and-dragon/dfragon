import { Hono } from 'hono'
import type { ClearStatsService } from '../../../application/content-clears/service.js'
import { CharacterDetailFailure } from '../../../domain/character-failure.js'
import { readQuery } from '../request-query.js'
import {
  type ClearContentStatsResponse,
  type ClearOverviewResponse,
  type ClearStatsResponse,
  weekQuery
} from './dto.js'

export class ClearStatsController {
  constructor(private readonly service: ClearStatsService) {}

  routes(): Hono {
    const routes = new Hono()

    routes.get('/', async (c) => {
      const stats: ClearStatsResponse = await this.service.stats()

      return c.json(stats)
    })

    routes.get('/overview', async (c) => {
      const parsed = weekQuery.safeParse(readQuery(c))

      if (!parsed.success) {
        throw new CharacterDetailFailure('query')
      }

      const overview: ClearOverviewResponse = await this.service.overview(parsed.data.week)

      return c.json(overview)
    })

    routes.get('/:contentId', async (c) => {
      const parsed = weekQuery.safeParse(readQuery(c))

      if (!parsed.success) {
        throw new CharacterDetailFailure('query')
      }

      const contentStats: ClearContentStatsResponse = await this.service.contentStats(
        c.req.param('contentId'),
        parsed.data.week
      )

      return c.json(contentStats)
    })

    return routes
  }
}
