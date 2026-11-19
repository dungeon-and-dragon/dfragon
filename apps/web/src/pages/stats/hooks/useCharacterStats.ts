import type { CharacterStats } from '#core/ranking'
import { useClientHost } from '#host/client-host'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'

export function useCharacterStats(): LoadedResult<CharacterStats> {
  const { getCharacterStats } = useClientHost()

  return useLoadedResult(['stats'], getCharacterStats)
}
