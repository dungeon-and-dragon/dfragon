import type { StoredCharacter, StoredGuild, TimelineCharacter } from '@dfragon/database'
import type {
  AdventureActivityOf,
  AdventureSeasonDays,
  StoredActivitySeason
} from '../../domain/adventure-guild/activity.js'
import type { AdventureWeeklyClears } from '../../domain/adventure-guild/weekly.js'
import type { SeasonBackfillJob } from '../../domain/character-timeline/season-backfill.js'
import type { SeasonBackfillQueue } from '../character-timeline/season-backfill.js'

export type AdventureActivityRead = {
  characters: TimelineCharacter[]
  activity: AdventureActivityOf<StoredActivitySeason>
}

export type AdventureSeasonBackfillRead = {
  characters: TimelineCharacter[]
  season: StoredActivitySeason
  jobs: SeasonBackfillJob[]
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
