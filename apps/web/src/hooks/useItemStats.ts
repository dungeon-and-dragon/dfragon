import type { ItemStats, SetStatsFilter } from '#core/ranking'
import { useClientHost } from '#host/client-host'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'

export function useItemStats(filter: SetStatsFilter): LoadedResult<ItemStats> {
  const { getItemStats } = useClientHost()

  return useLoadedResult(
    ['item-stats', filter.jobId ?? null, filter.jobGrowId ?? null, filter.role ?? null],
    () => getItemStats(filter)
  )
}
