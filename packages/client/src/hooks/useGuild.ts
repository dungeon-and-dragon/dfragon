import type { Guild } from '@dfragon/client-core/shared/adventure-guild/adventure-guild'
import { useClientHost } from './useClientHost'
import { type LoadedResult, useLoadedResult } from './useLoadedResult'

export function useGuild(guildId: string): LoadedResult<Guild> {
  const { getGuild } = useClientHost()

  return useLoadedResult(['guild', guildId], () => getGuild(guildId))
}
