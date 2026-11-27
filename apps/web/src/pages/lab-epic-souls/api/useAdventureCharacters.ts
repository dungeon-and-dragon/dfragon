import { type AdventureCharacters, adventureCharactersSchema } from '#entities/adventure-guild'
import { createJsonRequest } from '#shared/api/json-request'
import { API_BASE_URL, dfragonHttp } from '#shared/api/dfragon-api'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'

const requestJson = createJsonRequest(dfragonHttp, API_BASE_URL)

function requestAdventureCharacters(adventureName: string): Promise<AdventureCharacters> {
  return requestJson(
    `/adventures/${encodeURIComponent(adventureName)}/characters`,
    adventureCharactersSchema
  )
}

export function useAdventureCharacters(adventureName: string): LoadedResult<AdventureCharacters> {
  return useLoadedResult(['adventure', adventureName, 'characters'], () =>
    requestAdventureCharacters(adventureName)
  )
}
