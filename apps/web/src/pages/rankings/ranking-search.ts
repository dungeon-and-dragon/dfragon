import { z } from 'zod'
import { maleCrusaderRoleSchema } from '#core/character'
import type { FameRankingFilter, FameRankingSetFilter, SetStatsFilter } from '#core/ranking'
import { growFilter, RANKING_JOBS } from './ranking-jobs'

const text = z.string().min(1).optional().catch(undefined)

const searchSchema = z.object({
  jobId: z.string().optional().catch(undefined),
  jobGrowId: z.string().optional().catch(undefined),
  role: maleCrusaderRoleSchema.optional().catch(undefined),
  equipmentSetId: text,
  oathSetId: z.coerce.number().int().positive().optional().catch(undefined),
  oathSetOption: text
})

function jobFilterOf({ jobId, jobGrowId, role }: z.infer<typeof searchSchema>): SetStatsFilter {
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

// API는 서약 세트 없이 선택지만 받지 않으므로 그때는 선택지를 버린다.
function setFilterOf({
  equipmentSetId,
  oathSetId,
  oathSetOption
}: z.infer<typeof searchSchema>): FameRankingSetFilter {
  return {
    ...(equipmentSetId !== undefined && { equipmentSetId }),
    ...(oathSetId !== undefined && { oathSetId }),
    ...(oathSetId !== undefined && oathSetOption !== undefined && { oathSetOption })
  }
}

export function parseRankingSearch(search: Record<string, unknown>): FameRankingFilter {
  const parsed = searchSchema.parse(search)
  const jobFilter = jobFilterOf(parsed)
  const setFilter = setFilterOf(parsed)

  return { ...jobFilter, ...setFilter }
}

export function parseJobSearch(search: Record<string, unknown>): SetStatsFilter {
  return jobFilterOf(searchSchema.parse(search))
}
