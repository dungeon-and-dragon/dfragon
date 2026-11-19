import { createJsonRequest } from '#shared/api/json-request'
import { type Guild, guildSchema } from '#core/adventure-guild'
import { API_BASE_URL, dfragonHttp } from '#shared/api/dfragon-api'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'

const requestJson = createJsonRequest(dfragonHttp, API_BASE_URL)

export function useGuild(guildId: string): LoadedResult<Guild> {
  return useLoadedResult(['guild', guildId], () =>
    requestJson(`/guilds/${encodeURIComponent(guildId)}`, guildSchema)
  )
}
