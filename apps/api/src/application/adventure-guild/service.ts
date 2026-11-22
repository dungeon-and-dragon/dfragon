import type { StoredCharacter, StoredGuild, TimelineCharacter } from '@dfragon/database'
import {
  type ActivitySeason,
  type AdventureActivity,
  type AdventureSeasonDays,
  type AdventureTimelinePage,
  type AdventureTimelineQuery,
  type AdventureWeeklyClears,
  type EquipmentQuery,
  type SelectedAdventureEquipment,
  type StoredActivitySeason,
  emptySeasonActivity,
  selectAdventureEquipment
} from '#domain/adventure-guild/index.js'
import { CharacterDetailFailure } from '@dfragon/server-core/domain/character-failure.js'
import type { RequestTimelineSync } from '#application/character-timeline/index.js'
import type { SeasonBackfillRequests } from './ports.js'
import type { AdventureGuildRepository } from './repository.js'

export class AdventureGuildService {
  constructor(
    private readonly repository: AdventureGuildRepository,
    private readonly requestTimelineSync: RequestTimelineSync,
    private readonly seasonBackfill: SeasonBackfillRequests
  ) {}

  adventure(adventureName: string): Promise<StoredCharacter[]> {
    return this.repository.readAdventureCharacters(adventureName)
  }

  guild(guildId: string): Promise<StoredGuild> {
    return this.repository.readGuild(guildId)
  }

  async adventureWeekly(adventureName: string): Promise<AdventureWeeklyClears> {
    const weekly = await this.repository.readAdventureWeeklyClears(adventureName)

    // 동기화는 기다리지 않아 이번 응답은 지금 저장된 값이고, 다음 조회부터 새 클리어가 보인다.
    for (const { serverId, characterId } of weekly.characters) {
      this.requestTimelineSync({ serverId, characterId })
    }

    return weekly
  }

  async adventureEquipment(
    adventureName: string,
    query: EquipmentQuery
  ): Promise<SelectedAdventureEquipment> {
    const equipment = await this.repository.readAdventureEquipment(adventureName)

    for (const { characters } of equipment.servers) {
      for (const { serverId, characterId } of characters) {
        this.requestTimelineSync({ serverId, characterId })
      }
    }

    return selectAdventureEquipment(equipment, query)
  }

  async adventureTimeline(
    adventureName: string,
    query: AdventureTimelineQuery
  ): Promise<AdventureTimelinePage> {
    const { characters, page } = await this.repository.readAdventureTimeline(adventureName, query)

    // 이어 받기는 첫 묶음 뒤에만 오므로 첫 묶음을 줄 때만 동기화를 요청한다.
    if (query.before === undefined) {
      for (const { serverId, characterId } of characters) {
        this.requestTimelineSync({ serverId, characterId })
      }
    }

    return page
  }

  async adventureActivity(
    adventureName: string,
    seasonId: number | undefined
  ): Promise<AdventureActivity> {
    const read = await this.repository.readAdventureActivity(adventureName, seasonId)

    if (read === undefined) {
      throw new CharacterDetailFailure('query')
    }

    for (const { serverId, characterId } of read.characters) {
      this.requestTimelineSync({ serverId, characterId })
    }

    const seasons = read.activity.seasons.map((season) => this.withRunning(season, read.characters))

    return { ...read.activity, seasons }
  }

  async adventureSeasonDays(adventureName: string, seasonId: number): Promise<AdventureSeasonDays> {
    const days = await this.repository.readAdventureSeasonDays(adventureName, seasonId)

    if (days === undefined) {
      throw new CharacterDetailFailure('query')
    }

    return days
  }

  // 받기는 기다리지 않고 queue에 넣은 직후의 진행률을 준다.
  async adventureSeasonBackfill(adventureName: string, seasonId: number): Promise<ActivitySeason> {
    const read = await this.repository.readAdventureSeasonBackfill(adventureName, seasonId)

    if (read === undefined) {
      throw new CharacterDetailFailure('query')
    }

    for (const job of read.jobs) {
      this.seasonBackfill.request(job)
    }

    return this.withRunning(read.season, read.characters)
  }

  // 받는 중인지는 메모리 queue만 알아, DB에서 읽은 진행률에 여기서 붙인다.
  private withRunning(
    { backfill, ...season }: StoredActivitySeason,
    characters: readonly TimelineCharacter[]
  ): ActivitySeason {
    if (backfill === undefined) {
      return season
    }

    const running = characters.some((character) =>
      this.seasonBackfill.has({ character, seasonId: season.id })
    )

    return { ...season, backfill: { ...backfill, running } }
  }
}

export const noSeasonBackfill: SeasonBackfillRequests = {
  request: () => undefined,
  has: () => false
}

export const emptyAdventureGuildRepository: AdventureGuildRepository = {
  readAdventureCharacters: async () => [],
  readGuild: async () => ({ guildName: null, members: [] }),
  readAdventureWeeklyClears: async () => ({ clearNames: [], characters: [] }),
  readAdventureEquipment: async () => ({ sets: [], servers: [] }),
  readAdventureTimeline: async () => ({ characters: [], page: { items: [], nextCursor: null } }),
  readAdventureActivity: async (_adventureName, seasonId) => {
    if (seasonId !== undefined) {
      return undefined
    }

    const activity = emptySeasonActivity()

    return { characters: [], activity: { seasons: [], season: null, ...activity } }
  },
  readAdventureSeasonDays: async () => undefined,
  readAdventureSeasonBackfill: async () => undefined
}
