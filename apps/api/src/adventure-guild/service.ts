import type { StoredCharacter, StoredGuild, TimelineCharacter } from '@dfragon/database'
import { type CharacterRow, toCharacterRow } from '../domain/character-row.js'
import { CharacterDetailFailure } from '../domain/character-failure.js'
import type { RequestTimelineSync } from '../characters/timeline/queue.js'
import type { SeasonBackfillQueue } from '../characters/timeline/season-backfill.js'
import {
  type ActivitySeason,
  type AdventureActivity,
  type AdventureActivityRead,
  type AdventureSeasonDays,
  type AdventureSeasonBackfillRead,
  type StoredActivitySeason,
  emptySeasonActivity
} from './activity.js'
import type { AdventureWeeklyClears } from './weekly.js'

export type AdventureCharacters = {
  adventureName: string
  characters: CharacterRow[]
}

export type AdventureWeekly = AdventureWeeklyClears & { adventureName: string }

export type GuildMembers = {
  guildId: string
  guildName: string | null
  memberCount: number
  averageFame: number | null
  members: CharacterRow[]
}

export interface AdventureGuildReader {
  readAdventureCharacters(adventureName: string): Promise<StoredCharacter[]>
  readGuild(guildId: string): Promise<StoredGuild>
  readAdventureWeeklyClears(adventureName: string): Promise<AdventureWeeklyClears>
  readAdventureActivity(
    adventureName: string,
    seasonId: number | undefined
  ): Promise<AdventureActivityRead | undefined>
  readAdventureSeasonDays(
    adventureName: string,
    seasonId: number
  ): Promise<AdventureSeasonDays | undefined>
  readAdventureSeasonBackfill(
    adventureName: string,
    seasonId: number
  ): Promise<AdventureSeasonBackfillRead | undefined>
}

export type SeasonBackfillRequests = Pick<SeasonBackfillQueue, 'request' | 'has'>

export interface AdventureGuildService {
  adventure(adventureName: string): Promise<AdventureCharacters>
  guild(guildId: string): Promise<GuildMembers>
  adventureWeekly(adventureName: string): Promise<AdventureWeekly>
  adventureActivity(adventureName: string, seasonId: number | undefined): Promise<AdventureActivity>
  adventureSeasonDays(adventureName: string, seasonId: number): Promise<AdventureSeasonDays>
  adventureSeasonBackfill(adventureName: string, seasonId: number): Promise<ActivitySeason>
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
  requestTimelineSync: RequestTimelineSync,
  seasonBackfill: SeasonBackfillRequests
): AdventureGuildService {
  // 받는 중인지는 메모리 queue만 알아, DB에서 읽은 진행률에 여기서 붙인다.
  const withRunning = (
    { backfill, ...season }: StoredActivitySeason,
    characters: readonly TimelineCharacter[]
  ): ActivitySeason => {
    if (backfill === undefined) {
      return season
    }
    const running = characters.some((character) =>
      seasonBackfill.has({ character, seasonId: season.id })
    )

    return { ...season, backfill: { ...backfill, running } }
  }

  return {
    async adventure(adventureName) {
      const characters = await reader.readAdventureCharacters(adventureName)

      return { adventureName, characters: characters.map(toCharacterRow) }
    },
    async guild(guildId) {
      const { guildName, members } = await reader.readGuild(guildId)

      return {
        guildId,
        guildName,
        memberCount: members.length,
        averageFame: averageFame(members),
        members: members.map(toCharacterRow)
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
      const seasons = read.activity.seasons.map((season) => withRunning(season, read.characters))

      return { ...read.activity, seasons }
    },
    async adventureSeasonDays(adventureName, seasonId) {
      const days = await reader.readAdventureSeasonDays(adventureName, seasonId)
      if (days === undefined) {
        throw new CharacterDetailFailure('query')
      }

      return days
    },
    // 받기는 기다리지 않고 queue에 넣은 직후의 진행률을 준다.
    async adventureSeasonBackfill(adventureName, seasonId) {
      const read = await reader.readAdventureSeasonBackfill(adventureName, seasonId)
      if (read === undefined) {
        throw new CharacterDetailFailure('query')
      }
      for (const job of read.jobs) {
        seasonBackfill.request(job)
      }

      return withRunning(read.season, read.characters)
    }
  }
}

export const noSeasonBackfill: SeasonBackfillRequests = {
  request: () => undefined,
  has: () => false
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
    readAdventureSeasonDays: async () => undefined,
    readAdventureSeasonBackfill: async () => undefined
  },
  () => undefined,
  noSeasonBackfill
)
