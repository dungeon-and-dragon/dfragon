import type { CharacterStats } from '#core/ranking/ranking-stats'
import { useClientHost } from '../../../host/client-host'
import { type LoadedResult, useLoadedResult } from '../../../hooks/useLoadedResult'

export function useCharacterStats(): LoadedResult<CharacterStats> {
  const { getCharacterStats } = useClientHost()

  return useLoadedResult(['stats'], getCharacterStats)
}
