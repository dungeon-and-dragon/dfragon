import type { CharacterIdentity } from '#core/character/character'
import type { CharacterDetailView } from '#core/character/character-detail-view'
import type { CharacterHistory } from '#core/character/character-history'
import { useClientHost } from '../../../host/client-host'
import { type LoadedResult, useLoadedResult } from '../../../hooks/useLoadedResult'

export function useCharacterHistory({
  serverId,
  characterId
}: CharacterIdentity): LoadedResult<CharacterHistory> {
  const { getCharacterHistory } = useClientHost()

  return useLoadedResult(['character', serverId, characterId, 'history'], () =>
    getCharacterHistory({ serverId, characterId })
  )
}

export function useHistorySnapshot(
  { serverId, characterId }: CharacterIdentity,
  at: string | null
): LoadedResult<CharacterDetailView | null> {
  const { getCharacterHistorySnapshot } = useClientHost()

  return useLoadedResult(
    ['character', serverId, characterId, 'history', 'snapshot', at],
    async () => {
      if (at === null) {
        return null
      }

      return getCharacterHistorySnapshot({ serverId, characterId }, at)
    }
  )
}
