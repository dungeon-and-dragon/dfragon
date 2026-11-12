import { Hono } from 'hono'
import { z } from 'zod'
import type { ClearStatsService } from '../../../application/content-clears/service.js'
import { CharacterDetailFailure } from '../../../domain/character-failure.js'
import { readQuery } from '../request-query.js'

const contentStatsQuery = z.object({ week: z.iso.date().optional() })

export function createClearStatsRoutes(service: ClearStatsService): Hono {
  const routes = new Hono()

  routes.get('/', async (c) => c.json(await service.stats()))

  routes.get('/:contentId', async (c) => {
    const parsed = contentStatsQuery.safeParse(readQuery(c))
    if (!parsed.success) {
      throw new CharacterDetailFailure('query')
    }

    return c.json(await service.contentStats(c.req.param('contentId'), parsed.data.week))
  })

  return routes
}
