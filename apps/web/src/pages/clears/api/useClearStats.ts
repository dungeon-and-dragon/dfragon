import { createJsonRequest } from '#core/api'
import {
  type ClearContentStats,
  type ClearOverview,
  type ClearStats,
  clearContentStatsSchema,
  clearOverviewSchema,
  clearStatsSchema
} from '#core/ranking'
import { API_BASE_URL, dfragonHttp } from '#shared/api/dfragon-api'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'

const requestJson = createJsonRequest(dfragonHttp, API_BASE_URL)

// API는 클리어 통계를 한 번에 하나씩 계산해, 미리 계산하지 않은 주는 앞 계산을 기다린 뒤 1분 가까이 더 걸린다.
const CLEAR_STATS_TIMEOUT_MS = 120_000

export function useClearStats(): LoadedResult<ClearStats> {
  return useLoadedResult(['clear-stats'], () =>
    requestJson('/stats/clears', clearStatsSchema, { timeout: CLEAR_STATS_TIMEOUT_MS })
  )
}

export function useClearContentStats(
  contentId: string,
  weekStart: string
): LoadedResult<ClearContentStats> {
  return useLoadedResult(['clear-stats', contentId, weekStart], () =>
    requestJson(`/stats/clears/${encodeURIComponent(contentId)}`, clearContentStatsSchema, {
      searchParams: { week: weekStart },
      timeout: CLEAR_STATS_TIMEOUT_MS
    })
  )
}

export function useClearOverview(weekStart: string): LoadedResult<ClearOverview> {
  return useLoadedResult(['clear-overview', weekStart], () =>
    requestJson('/stats/clears/overview', clearOverviewSchema, {
      searchParams: { week: weekStart },
      timeout: CLEAR_STATS_TIMEOUT_MS
    })
  )
}
