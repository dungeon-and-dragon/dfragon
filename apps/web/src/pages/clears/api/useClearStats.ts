import { queryOptions } from '@tanstack/react-query'
import { createJsonRequest } from '#shared/api/json-request'
import {
  type ClearContentStats,
  type ClearOverview,
  type ClearStats,
  clearContentStatsSchema,
  clearOverviewSchema,
  clearStatsSchema
} from '#entities/ranking'
import { API_BASE_URL, dfragonHttp } from '#shared/api/dfragon-api'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'

const requestJson = createJsonRequest(dfragonHttp, API_BASE_URL)

// API는 클리어 통계를 한 번에 하나씩 계산해, 미리 계산하지 않은 주는 앞 계산을 기다린 뒤 1분 가까이 더 걸린다.
const BROWSER_TIMEOUT_MS = 120_000
// 서버는 화면을 그리기 전에 받으므로 오래 기다리지 않고, 못 받으면 받는 중 모양으로 그려 브라우저가 이어서 받게 한다.
const SERVER_TIMEOUT_MS = 5000
const CLEAR_STATS_TIMEOUT_MS =
  typeof window === 'undefined' ? SERVER_TIMEOUT_MS : BROWSER_TIMEOUT_MS
const CLEAR_STATS_KEY = ['clear-stats']

function requestClearStats(): Promise<ClearStats> {
  return requestJson('/stats/clears', clearStatsSchema, { timeout: CLEAR_STATS_TIMEOUT_MS })
}

function clearContentStatsKey(contentId: string, weekStart: string) {
  return ['clear-stats', contentId, weekStart]
}

function requestClearContentStats(
  contentId: string,
  weekStart: string
): Promise<ClearContentStats> {
  return requestJson(`/stats/clears/${encodeURIComponent(contentId)}`, clearContentStatsSchema, {
    searchParams: { week: weekStart },
    timeout: CLEAR_STATS_TIMEOUT_MS
  })
}

function clearOverviewKey(weekStart: string) {
  return ['clear-overview', weekStart]
}

function requestClearOverview(weekStart: string): Promise<ClearOverview> {
  return requestJson('/stats/clears/overview', clearOverviewSchema, {
    searchParams: { week: weekStart },
    timeout: CLEAR_STATS_TIMEOUT_MS
  })
}

// 서버가 화면을 그리기 전에 받아 둘 때와 화면의 hook이 같은 key와 요청을 쓴다.
export const clearStatsQuery = queryOptions({
  queryKey: CLEAR_STATS_KEY,
  queryFn: requestClearStats
})

export function clearContentStatsQuery(contentId: string, weekStart: string) {
  const queryKey = clearContentStatsKey(contentId, weekStart)

  return queryOptions({ queryKey, queryFn: () => requestClearContentStats(contentId, weekStart) })
}

export function clearOverviewQuery(weekStart: string) {
  const queryKey = clearOverviewKey(weekStart)

  return queryOptions({ queryKey, queryFn: () => requestClearOverview(weekStart) })
}

export function useClearStats(): LoadedResult<ClearStats> {
  return useLoadedResult(CLEAR_STATS_KEY, requestClearStats)
}

export function useClearContentStats(
  contentId: string,
  weekStart: string
): LoadedResult<ClearContentStats> {
  return useLoadedResult(clearContentStatsKey(contentId, weekStart), () =>
    requestClearContentStats(contentId, weekStart)
  )
}

export function useClearOverview(weekStart: string): LoadedResult<ClearOverview> {
  return useLoadedResult(clearOverviewKey(weekStart), () => requestClearOverview(weekStart))
}
