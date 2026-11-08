import type { CharacterSearchQuery, SearchedCharacter } from '#core/shared/api/character-schemas'
import { useClientHost } from '../host/client-host'
import { type LoadedResult, useLoadedResult } from './useLoadedResult'

export function useSearchedCharacters(
  query: CharacterSearchQuery
): LoadedResult<readonly SearchedCharacter[]> {
  const { searchCharacters } = useClientHost()

  return useLoadedResult(['character-search', query.serverId, query.characterName], () =>
    searchCharacters(query)
  )
}
