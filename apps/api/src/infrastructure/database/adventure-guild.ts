import {
  type DatabaseClient,
  type RankedStoredCharacter,
  type StoredGuild,
  readAdventureSetCharacters,
  readGuild
} from '@dfragon/database'
import type {
  AdventureActivityRead,
  AdventureGuildRepository,
  AdventureSeasonBackfillRead,
  AdventureTimelineRead
} from '#application/adventure-guild/repository.js'
import type {
  AdventureEquipment,
  AdventureSeasonDays,
  AdventureTimelineQuery,
  AdventureWeeklyClears
} from '#domain/adventure-guild/index.js'
import {
  readAdventureActivity,
  readAdventureSeasonBackfill,
  readAdventureSeasonDays
} from './adventure-activity.js'
import { readAdventureEquipment } from './adventure-equipment.js'
import { readAdventureTimeline } from './adventure-timeline.js'
import { readAdventureWeeklyClears } from './adventure-weekly.js'

export class DatabaseAdventureGuildRepository implements AdventureGuildRepository {
  constructor(private readonly client: DatabaseClient) {}

  readAdventureCharacters(adventureName: string): Promise<RankedStoredCharacter[]> {
    return readAdventureSetCharacters(this.client, adventureName)
  }

  readGuild(guildId: string): Promise<StoredGuild> {
    return readGuild(this.client, guildId)
  }

  readAdventureWeeklyClears(adventureName: string): Promise<AdventureWeeklyClears> {
    return readAdventureWeeklyClears(this.client, adventureName, new Date())
  }

  readAdventureEquipment(adventureName: string): Promise<AdventureEquipment> {
    return readAdventureEquipment(this.client, adventureName, new Date())
  }

  readAdventureTimeline(
    adventureName: string,
    query: AdventureTimelineQuery
  ): Promise<AdventureTimelineRead> {
    return readAdventureTimeline(this.client, adventureName, query)
  }

  readAdventureActivity(
    adventureName: string,
    seasonId: number | undefined
  ): Promise<AdventureActivityRead | undefined> {
    return readAdventureActivity(this.client, adventureName, seasonId, new Date())
  }

  readAdventureSeasonDays(
    adventureName: string,
    seasonId: number
  ): Promise<AdventureSeasonDays | undefined> {
    return readAdventureSeasonDays(this.client, adventureName, seasonId, new Date())
  }

  readAdventureSeasonBackfill(
    adventureName: string,
    seasonId: number
  ): Promise<AdventureSeasonBackfillRead | undefined> {
    return readAdventureSeasonBackfill(this.client, adventureName, seasonId, new Date())
  }
}
