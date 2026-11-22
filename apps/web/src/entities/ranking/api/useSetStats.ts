import { queryOptions } from '@tanstack/react-query'
import { type SetStats, setStatsSchema } from '#entities/ranking/model/set-stats'
import { type SetStatsFilter } from '#entities/ranking/model/ranking-stats'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'
import { requestJobStats } from './job-stats-request'

function setStatsKey(filter: SetStatsFilter) {
  return [
    'set-stats',
    filter.jobId ?? null,
    filter.jobGrowId ?? null,
    filter.role ?? null,
    filter.sample ?? null
  ]
}

function requestSetStats(filter: SetStatsFilter): Promise<SetStats> {
  return requestJobStats('/stats/sets', setStatsSchema, filter)
}

// 서버가 화면을 그리기 전에 받아 둘 때와 화면의 hook이 같은 key와 요청을 쓴다.
export function setStatsQuery(filter: SetStatsFilter) {
  const queryKey = setStatsKey(filter)

  return queryOptions({ queryKey, queryFn: () => requestSetStats(filter) })
}

export function useSetStats(filter: SetStatsFilter): LoadedResult<SetStats> {
  return useLoadedResult(setStatsKey(filter), () => requestSetStats(filter))
}
