import { z } from 'zod'
import { maleCrusaderRoleSchema } from '#core/character/male-crusader'
import type { FameRankingFilter } from '#core/ranking/ranking-stats'
import { growFilter, RANKING_JOBS } from './ranking-jobs'

const searchSchema = z.object({
  jobId: z.string().optional().catch(undefined),
  jobGrowId: z.string().optional().catch(undefined),
  role: maleCrusaderRoleSchema.optional().catch(undefined)
})

export function parseRankingSearch(search: Record<string, unknown>): FameRankingFilter {
  const { jobId, jobGrowId, role } = searchSchema.parse(search)
  const job = RANKING_JOBS.find((candidate) => candidate.jobId === jobId)
  if (job === undefined) {
    return {}
  }

  // role을 받지 않는 전직이면 role만 버린다. 남성 크루세이더는 역할 없는 칩이 없어 역할을 모르면 직업 랭킹을 연다.
  const sameGrow = job.grows.filter((grow) => grow.jobGrowId === jobGrowId)
  const grow =
    sameGrow.find((candidate) => candidate.role === role) ??
    sameGrow.find((candidate) => candidate.role === undefined)
  if (grow === undefined) {
    return { jobId: job.jobId }
  }

  return growFilter(job, grow)
}
