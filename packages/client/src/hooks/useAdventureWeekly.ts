import type { AdventureWeekly } from '@dfragon/client-core/shared/adventure-guild/adventure-weekly'
import { useClientHost } from './useClientHost'
import { type LoadedResult, useLoadedResult } from './useLoadedResult'

export function useAdventureWeekly(
  adventureName: string,
  revision: number
): LoadedResult<AdventureWeekly> {
  const { getAdventureWeekly } = useClientHost()

  return useLoadedResult(`${revision}/${adventureName}`, () => getAdventureWeekly(adventureName))
}
