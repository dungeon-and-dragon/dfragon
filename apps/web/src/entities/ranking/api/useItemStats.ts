import { type ItemStats, itemStatsSchema, type SetStatsFilter } from '#core/ranking'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'
import { requestJobStats } from './job-stats-request'

export function useItemStats(filter: SetStatsFilter): LoadedResult<ItemStats> {
  return useLoadedResult(
    ['item-stats', filter.jobId ?? null, filter.jobGrowId ?? null, filter.role ?? null],
    () => requestJobStats('/stats/items', itemStatsSchema, filter)
  )
}
