import { Hono } from 'hono'
import { z } from 'zod'
import type { RankingStatsService } from '../../../application/ranking-stats/service.js'
import { CharacterDetailFailure } from '../../../domain/character-failure.js'
import { isMaleCrusaderJob } from '../../../domain/male-crusader.js'
import { readQuery } from '../request-query.js'

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

export function createRankingStatsRoutes(service: RankingStatsService): Hono {
  const routes = new Hono()

  routes.get('/rankings/fame', async (c) => {
    const filter = fameRankingQuery.safeParse(readQuery(c))
    if (!filter.success) {
      throw new CharacterDetailFailure('query')
    }

    return c.json(await service.fameRanking(filter.data))
  })

  routes.get('/stats', async (c) => c.json(await service.stats()))

  routes.get('/stats/skills', async (c) => {
    const job = skillStatsQuery.safeParse(readQuery(c))
    if (!job.success) {
      throw new CharacterDetailFailure('query')
    }

    return c.json(await service.skillStats(job.data))
  })

  return routes
}
