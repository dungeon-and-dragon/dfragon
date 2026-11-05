import type {
  FameRanking,
  FameRankingFilter
} from '@dfragon/client-core/shared/ranking/ranking-stats'
import { useClientHost } from './useClientHost'
import { type LoadedResult, useLoadedResult } from './useLoadedResult'

export function useFameRanking(filter: FameRankingFilter): LoadedResult<FameRanking> {
  const { getFameRanking } = useClientHost()

  return useLoadedResult(`${filter.jobId ?? ''}/${filter.jobGrowId ?? ''}`, () =>
    getFameRanking(filter)
  )
}
