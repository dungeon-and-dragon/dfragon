import {
  type CharacterDetailView,
  type CharacterHistory,
  type CharacterIdentity,
  characterHistorySchema
} from '#entities/character'
import { detailViewSchemaOf, requestCharacterJson } from '#entities/character-detail'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'

export function useCharacterHistory({
  serverId,
  characterId
}: CharacterIdentity): LoadedResult<CharacterHistory> {
  return useLoadedResult(['character', serverId, characterId, 'history'], () =>
    requestCharacterJson({ serverId, characterId }, '/history', characterHistorySchema)
  )
}

export function useHistorySnapshot(
  { serverId, characterId }: CharacterIdentity,
  at: string | null
): LoadedResult<CharacterDetailView | null> {
  return useLoadedResult(
    ['character', serverId, characterId, 'history', 'snapshot', at],
    async () => {
      if (at === null) {
        return null
      }

      const identity = { serverId, characterId }

      return requestCharacterJson(identity, '/history/snapshot', detailViewSchemaOf(identity), {
        searchParams: { at }
      })
    }
  )
}
