import { type ItemStats, itemStatsSchema } from '#entities/ranking/model/item-stats'
import { type SetStatsFilter } from '#entities/ranking/model/ranking-stats'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'
import { requestJobStats } from './job-stats-request'

export function useItemStats(filter: SetStatsFilter): LoadedResult<ItemStats> {
  return useLoadedResult(
    [
      'item-stats',
      filter.jobId ?? null,
      filter.jobGrowId ?? null,
      filter.role ?? null,
      filter.sample ?? null
    ],
    () => requestJobStats('/stats/items', itemStatsSchema, filter)
  )
}
