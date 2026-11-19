import type { Guild } from '#core/adventure-guild'
import { useClientHost } from '#host/client-host'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'

export function useGuild(guildId: string): LoadedResult<Guild> {
  const { getGuild } = useClientHost()

  return useLoadedResult(['guild', guildId], () => getGuild(guildId))
}
