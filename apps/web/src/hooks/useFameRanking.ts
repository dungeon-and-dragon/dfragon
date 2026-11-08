import type { FameRanking, FameRankingFilter } from '#core/shared/ranking/ranking-stats'
import { useClientHost } from '../host/client-host'
import { type LoadedResult, useLoadedResult } from './useLoadedResult'

export function useFameRanking(filter: FameRankingFilter): LoadedResult<FameRanking> {
  const { getFameRanking } = useClientHost()

  return useLoadedResult(['fame-ranking', filter.jobId ?? null, filter.jobGrowId ?? null], () =>
    getFameRanking(filter)
  )
}
