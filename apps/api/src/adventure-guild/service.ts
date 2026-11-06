import type { StoredCharacter, StoredGuild } from '@dfragon/database'
import { CharacterDetailFailure } from '../characters/details/errors.js'
import type { RequestTimelineSync } from '../characters/timeline/queue.js'
import {
  type ActivityDayDetail,
  type ActivityDayRange,
  type AdventureActivity,
  type AdventureActivityRead,
  emptySeasonActivity,
  toActivityDayDetail
} from './activity.js'
import type { AdventureWeeklyClears } from './weekly.js'

export type AdventureCharacters = {
  adventureName: string
  characters: StoredCharacter[]
}

export type AdventureWeekly = AdventureWeeklyClears & { adventureName: string }

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
  readAdventureWeeklyClears(adventureName: string): Promise<AdventureWeeklyClears>
  readAdventureActivity(
    adventureName: string,
    seasonId: number | undefined
  ): Promise<AdventureActivityRead | undefined>
  readAdventureActivityDay(adventureName: string, day: ActivityDayRange): Promise<ActivityDayDetail>
}

export interface AdventureGuildService {
  adventure(adventureName: string): Promise<AdventureCharacters>
  guild(guildId: string): Promise<GuildMembers>
  adventureWeekly(adventureName: string): Promise<AdventureWeekly>
  adventureActivity(adventureName: string, seasonId: number | undefined): Promise<AdventureActivity>
  adventureActivityDay(adventureName: string, day: ActivityDayRange): Promise<ActivityDayDetail>
}

function averageFame(members: readonly StoredCharacter[]): number | null {
  const fames = members.map(({ fame }) => fame).filter((fame) => fame !== null)
  if (fames.length === 0) {
    return null
  }

  return Math.round(fames.reduce((sum, fame) => sum + fame, 0) / fames.length)
}

export function createAdventureGuildService(
  reader: AdventureGuildReader,
  requestTimelineSync: RequestTimelineSync
): AdventureGuildService {
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
    },
    async adventureWeekly(adventureName) {
      const weekly = await reader.readAdventureWeeklyClears(adventureName)
      // 동기화는 기다리지 않아 이번 응답은 지금 저장된 값이고, 다음 조회부터 새 클리어가 보인다.
      for (const { serverId, characterId } of weekly.characters) {
        requestTimelineSync({ serverId, characterId })
      }

      return { adventureName, ...weekly }
    },
    async adventureActivity(adventureName, seasonId) {
      const read = await reader.readAdventureActivity(adventureName, seasonId)
      if (read === undefined) {
        throw new CharacterDetailFailure('query')
      }
      for (const { serverId, characterId } of read.characters) {
        requestTimelineSync({ serverId, characterId })
      }

      return read.activity
    },
    // 하루 상세는 시즌 조회가 이미 동기화를 건 뒤 화면이 부르므로 다시 걸지 않는다.
    adventureActivityDay(adventureName, day) {
      return reader.readAdventureActivityDay(adventureName, day)
    }
  }
}

export const emptyAdventureGuildService = createAdventureGuildService(
  {
    readAdventureCharacters: async () => [],
    readGuild: async () => ({ guildName: null, members: [] }),
    readAdventureWeeklyClears: async () => ({ clearNames: [], characters: [] }),
    readAdventureActivity: async (_adventureName, seasonId) => {
      if (seasonId !== undefined) {
        return undefined
      }

      return {
        characters: [],
        activity: { seasons: [], season: null, ...emptySeasonActivity() }
      }
    },
    readAdventureActivityDay: async (_adventureName, day) =>
      toActivityDayDetail(day, { clears: [], items: [] })
  },
  () => undefined
)
