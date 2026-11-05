import type {
  CharacterSearchQuery,
  SearchedCharacter
} from '@dfragon/client-core/shared/search/character-http'
import { useClientHost } from './useClientHost'
import { type LoadedResult, useLoadedResult } from './useLoadedResult'

export function useSearchedCharacters(
  query: CharacterSearchQuery
): LoadedResult<readonly SearchedCharacter[]> {
  const { searchCharacters } = useClientHost()

  return useLoadedResult(`${query.serverId}/${query.characterName}`, () => searchCharacters(query))
}
