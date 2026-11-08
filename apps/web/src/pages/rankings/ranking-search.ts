import { z } from 'zod'
import type { FameRankingFilter } from '#core/ranking/ranking-stats'
import { RANKING_JOBS } from './ranking-jobs'

const searchSchema = z.object({
  jobId: z.string().optional().catch(undefined),
  jobGrowId: z.string().optional().catch(undefined)
})

export function parseRankingSearch(search: Record<string, unknown>): FameRankingFilter {
  const { jobId, jobGrowId } = searchSchema.parse(search)
  const job = RANKING_JOBS.find((candidate) => candidate.jobId === jobId)
  if (job === undefined) {
    return {}
  }

  if (job.grows.some((grow) => grow.jobGrowId === jobGrowId)) {
    return { jobId: job.jobId, jobGrowId }
  }

  return { jobId: job.jobId }
}
