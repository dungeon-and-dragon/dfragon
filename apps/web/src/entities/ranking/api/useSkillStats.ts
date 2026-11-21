import { createJsonRequest } from '#shared/api/json-request'
import {
  type SkillStats,
  type SkillStatsJob,
  skillStatsSchema
} from '#entities/ranking/model/skill-stats'
import { API_BASE_URL, dfragonHttp } from '#shared/api/dfragon-api'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'

const requestJson = createJsonRequest(dfragonHttp, API_BASE_URL)

export function skillStatsQueryKey({ jobId, jobGrowId, role }: SkillStatsJob) {
  return ['skill-stats', jobId, jobGrowId, role] as const
}

export function useSkillStats(job: SkillStatsJob, enabled = true): LoadedResult<SkillStats> {
  const { jobId, jobGrowId, role } = job

  return useLoadedResult(
    skillStatsQueryKey(job),
    () =>
      requestJson('/stats/skills', skillStatsSchema, {
        searchParams: { jobId, jobGrowId, ...(role !== null && { role }) }
      }),
    { enabled }
  )
}
