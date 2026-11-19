import { type SetStats, type SetStatsFilter, setStatsSchema } from '#core/ranking'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'
import { requestJobStats } from './job-stats-request'

export function useSetStats(filter: SetStatsFilter): LoadedResult<SetStats> {
  return useLoadedResult(
    ['set-stats', filter.jobId ?? null, filter.jobGrowId ?? null, filter.role ?? null],
    () => requestJobStats('/stats/sets', setStatsSchema, filter)
  )
}
