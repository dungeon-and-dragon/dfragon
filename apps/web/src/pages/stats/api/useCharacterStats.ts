import { createJsonRequest } from '#shared/api/json-request'
import { type CharacterStats, characterStatsSchema } from '#entities/ranking'
import { API_BASE_URL, dfragonHttp } from '#shared/api/dfragon-api'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'

const requestJson = createJsonRequest(dfragonHttp, API_BASE_URL)

export function useCharacterStats(): LoadedResult<CharacterStats> {
  return useLoadedResult(['stats'], () => requestJson('/stats', characterStatsSchema))
}
