import { queryOptions } from '@tanstack/react-query'
import { type ItemStats, itemStatsSchema } from '#entities/ranking/model/item-stats'
import { type SetStatsFilter } from '#entities/ranking/model/ranking-stats'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'
import { requestJobStats } from './job-stats-request'

function itemStatsKey(filter: SetStatsFilter) {
  return [
    'item-stats',
    filter.jobId ?? null,
    filter.jobGrowId ?? null,
    filter.role ?? null,
    filter.sample ?? null
  ]
}

function requestItemStats(filter: SetStatsFilter): Promise<ItemStats> {
  return requestJobStats('/stats/items', itemStatsSchema, filter)
}

// 서버가 화면을 그리기 전에 받아 둘 때와 화면의 hook이 같은 key와 요청을 쓴다.
export function itemStatsQuery(filter: SetStatsFilter) {
  const queryKey = itemStatsKey(filter)

  return queryOptions({ queryKey, queryFn: () => requestItemStats(filter) })
}

export function useItemStats(filter: SetStatsFilter): LoadedResult<ItemStats> {
  return useLoadedResult(itemStatsKey(filter), () => requestItemStats(filter))
}
