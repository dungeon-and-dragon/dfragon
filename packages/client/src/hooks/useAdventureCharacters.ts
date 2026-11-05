import type { AdventureCharacters } from '@dfragon/client-core/shared/adventure-guild/adventure-guild'
import { useClientHost } from './useClientHost'
import { type LoadedResult, useLoadedResult } from './useLoadedResult'

export function useAdventureCharacters(adventureName: string): LoadedResult<AdventureCharacters> {
  const { getAdventureCharacters } = useClientHost()

  return useLoadedResult(adventureName, () => getAdventureCharacters(adventureName))
}
