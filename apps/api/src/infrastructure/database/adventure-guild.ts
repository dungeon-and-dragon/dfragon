import {
  type DatabaseClient,
  type StoredCharacter,
  type StoredGuild,
  readAdventureCharacters,
  readGuild
} from '@dfragon/database'
import type {
  AdventureActivityRead,
  AdventureGuildRepository,
  AdventureSeasonBackfillRead
} from '../../application/adventure-guild/repository.js'
import type { AdventureSeasonDays } from '../../domain/adventure-guild/activity.js'
import type { AdventureWeeklyClears } from '../../domain/adventure-guild/weekly.js'
import {
  readAdventureActivity,
  readAdventureSeasonBackfill,
  readAdventureSeasonDays
} from './adventure-activity.js'
import { readAdventureWeeklyClears } from './adventure-weekly.js'

export class DatabaseAdventureGuildRepository implements AdventureGuildRepository {
  constructor(private readonly client: DatabaseClient) {}

  readAdventureCharacters(adventureName: string): Promise<StoredCharacter[]> {
    return readAdventureCharacters(this.client, adventureName)
  }

  readGuild(guildId: string): Promise<StoredGuild> {
    return readGuild(this.client, guildId)
  }

  readAdventureWeeklyClears(adventureName: string): Promise<AdventureWeeklyClears> {
    return readAdventureWeeklyClears(this.client, adventureName, new Date())
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
