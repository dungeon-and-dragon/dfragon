import type { StoredCharacter, StoredGuild } from '@dfragon/database'

export type AdventureCharacters = {
  adventureName: string
  characters: StoredCharacter[]
}

export type GuildMembers = {
  guildId: string
  guildName: string | null
  memberCount: number
  averageFame: number | null
  members: StoredCharacter[]
}

export interface AdventureGuildReader {
  readAdventureCharacters(adventureName: string): Promise<StoredCharacter[]>
  readGuild(guildId: string): Promise<StoredGuild>
}

export interface AdventureGuildService {
  adventure(adventureName: string): Promise<AdventureCharacters>
  guild(guildId: string): Promise<GuildMembers>
}

function averageFame(members: readonly StoredCharacter[]): number | null {
  const fames = members.map(({ fame }) => fame).filter((fame) => fame !== null)
  if (fames.length === 0) {
    return null
  }

  return Math.round(fames.reduce((sum, fame) => sum + fame, 0) / fames.length)
}

export function createAdventureGuildService(reader: AdventureGuildReader): AdventureGuildService {
  return {
    async adventure(adventureName) {
      const characters = await reader.readAdventureCharacters(adventureName)

      return { adventureName, characters }
    },
    async guild(guildId) {
      const { guildName, members } = await reader.readGuild(guildId)

      return {
        guildId,
        guildName,
        memberCount: members.length,
        averageFame: averageFame(members),
        members
      }
    }
  }
}

export const emptyAdventureGuildService = createAdventureGuildService({
  readAdventureCharacters: async () => [],
  readGuild: async () => ({ guildName: null, members: [] })
})
