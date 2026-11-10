import type { ClearContentStats, ClearStats } from '#core/ranking/clear-stats'
import { useClientHost } from '../../../host/client-host'
import { type LoadedResult, useLoadedResult } from '../../../hooks/useLoadedResult'

export function useClearStats(): LoadedResult<ClearStats> {
  const { getClearStats } = useClientHost()

  return useLoadedResult(['clear-stats'], getClearStats)
}

export function useClearContentStats(
  contentId: string,
  weekStart: string
): LoadedResult<ClearContentStats> {
  const { getClearContentStats } = useClientHost()

  return useLoadedResult(['clear-stats', contentId, weekStart], () =>
    getClearContentStats(contentId, weekStart)
  )
}
