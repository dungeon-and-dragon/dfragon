import type { SetStats, SetStatsFilter } from '#core/ranking'
import { useClientHost } from '#host/client-host'
import { type LoadedResult, useLoadedResult } from './useLoadedResult'

export function useSetStats(filter: SetStatsFilter): LoadedResult<SetStats> {
  const { getSetStats } = useClientHost()

  return useLoadedResult(
    ['set-stats', filter.jobId ?? null, filter.jobGrowId ?? null, filter.role ?? null],
    () => getSetStats(filter)
  )
}
