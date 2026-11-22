import { queryOptions } from '@tanstack/react-query'
import { createJsonRequest } from '#shared/api/json-request'
import { type Guild, guildSchema } from '#entities/adventure-guild'
import { API_BASE_URL, dfragonHttp } from '#shared/api/dfragon-api'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'

const requestJson = createJsonRequest(dfragonHttp, API_BASE_URL)

function guildKey(guildId: string) {
  return ['guild', guildId]
}

function requestGuild(guildId: string): Promise<Guild> {
  return requestJson(`/guilds/${encodeURIComponent(guildId)}`, guildSchema)
}

// 서버가 화면을 그리기 전에 받아 둘 때와 화면의 hook이 같은 key와 요청을 쓴다.
export function guildQuery(guildId: string) {
  return queryOptions({ queryKey: guildKey(guildId), queryFn: () => requestGuild(guildId) })
}

export function useGuild(guildId: string): LoadedResult<Guild> {
  return useLoadedResult(guildKey(guildId), () => requestGuild(guildId))
}
