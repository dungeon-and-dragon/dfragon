import { createJsonRequest } from '#core/api'
import { type SkillStats, type SkillStatsJob, skillStatsSchema } from '#core/ranking'
import { API_BASE_URL, dfragonHttp } from '#shared/api/dfragon-api'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'

const requestJson = createJsonRequest(dfragonHttp, API_BASE_URL)

export function useSkillStats({ jobId, jobGrowId, role }: SkillStatsJob): LoadedResult<SkillStats> {
  return useLoadedResult(['skill-stats', jobId, jobGrowId, role], () =>
    requestJson('/stats/skills', skillStatsSchema, {
      searchParams: { jobId, jobGrowId, ...(role !== null && { role }) }
    })
  )
}
