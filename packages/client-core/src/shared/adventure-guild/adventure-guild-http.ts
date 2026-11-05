import { CHARACTER_HTTP_LIMITS, type ApiOptions } from '../search/character-http'
import { createJsonRequest } from '../ranking/ranking-stats-http'
import {
  adventureCharactersSchema,
  guildSchema,
  type AdventureCharacters,
  type Guild
} from './adventure-guild'

export type AdventureCharactersHttp = (adventureName: string) => Promise<AdventureCharacters>
export type GuildHttp = (guildId: string) => Promise<Guild>

export function createAdventureCharactersHttp(options: ApiOptions): AdventureCharactersHttp {
  return (adventureName) =>
    createJsonRequest(
      options,
      `/adventures/${encodeURIComponent(adventureName)}/characters`,
      adventureCharactersSchema,
      CHARACTER_HTTP_LIMITS.adventureGuildJsonBytes
    )()
}

export function createGuildHttp(options: ApiOptions): GuildHttp {
  return (guildId) =>
    createJsonRequest(
      options,
      `/guilds/${encodeURIComponent(guildId)}`,
      guildSchema,
      CHARACTER_HTTP_LIMITS.adventureGuildJsonBytes
    )()
}
