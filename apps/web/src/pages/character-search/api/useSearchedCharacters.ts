import {
  type CharacterSearchQuery,
  candidatesSchema,
  type SearchedCharacter,
  validateSearchQuery
} from '#core/character'
import { createJsonRequest } from '#shared/api/json-request'
import { API_BASE_URL, dfragonHttp } from '#shared/api/dfragon-api'
import { ALL_CHARACTER_SERVERS } from '#shared/config/server-options'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'

const requestJson = createJsonRequest(dfragonHttp, API_BASE_URL)

const CHARACTER_SEARCH_LIMIT = '200'

async function requestSearchedCharacters(
  query: CharacterSearchQuery
): Promise<readonly SearchedCharacter[]> {
  validateSearchQuery(query)

  const { rows } = await requestJson(
    '/characters',
    candidatesSchema.refine(
      ({ rows }) =>
        query.serverId === ALL_CHARACTER_SERVERS ||
        rows.every((row) => row.serverId === query.serverId)
    ),
    {
      searchParams: {
        characterName: query.characterName,
        serverId: query.serverId,
        limit: CHARACTER_SEARCH_LIMIT
      },
      details: false
    }
  )

  return rows
}

export function useSearchedCharacters(
  query: CharacterSearchQuery
): LoadedResult<readonly SearchedCharacter[]> {
  return useLoadedResult(['character-search', query.serverId, query.characterName], () =>
    requestSearchedCharacters(query)
  )
}
