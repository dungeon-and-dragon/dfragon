import { createJsonRequest } from '#shared/api/json-request'
import { type CharacterStats, characterStatsSchema } from '#entities/ranking'
import { API_BASE_URL, dfragonHttp } from '#shared/api/dfragon-api'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'

const requestJson = createJsonRequest(dfragonHttp, API_BASE_URL)

function requestCharacterStats(): Promise<CharacterStats> {
  return requestJson('/stats', characterStatsSchema)
}

// 서버가 화면을 그리기 전에 받아 둘 때와 화면의 hook이 같은 key와 요청을 쓴다.
export const characterStatsQuery = { queryKey: ['stats'], queryFn: requestCharacterStats } as const

export function useCharacterStats(): LoadedResult<CharacterStats> {
  return useLoadedResult(characterStatsQuery.queryKey, characterStatsQuery.queryFn)
}
