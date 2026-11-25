import { queryOptions } from '@tanstack/react-query'
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

function requestSkillStats({ jobId, jobGrowId, role }: SkillStatsJob): Promise<SkillStats> {
  return requestJson('/stats/skills', skillStatsSchema, {
    searchParams: { jobId, jobGrowId, ...(role !== null && { role }) }
  })
}

// 서버가 화면을 그리기 전에 받아 둘 때와 화면의 hook이 같은 key와 요청을 쓴다.
export function skillStatsQuery(job: SkillStatsJob) {
  const queryKey = skillStatsQueryKey(job)

  return queryOptions({ queryKey, queryFn: () => requestSkillStats(job) })
}

export function useSkillStats(job: SkillStatsJob, enabled = true): LoadedResult<SkillStats> {
  return useLoadedResult(skillStatsQueryKey(job), () => requestSkillStats(job), { enabled })
}
