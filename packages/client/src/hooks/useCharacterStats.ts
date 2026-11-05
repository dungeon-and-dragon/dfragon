import type { CharacterStats } from '@dfragon/client-core/shared/ranking/ranking-stats'
import { useClientHost } from './useClientHost'
import { type LoadedResult, useLoadedResult } from './useLoadedResult'

export function useCharacterStats(): LoadedResult<CharacterStats> {
  const { getCharacterStats } = useClientHost()

  return useLoadedResult(['stats'], getCharacterStats)
}
