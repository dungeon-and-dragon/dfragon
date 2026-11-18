import type { StoredCharacter, StoredGuild, TimelineCharacter } from '@dfragon/database'
import type {
  AdventureActivityOf,
  AdventureSeasonDays,
  AdventureWeeklyClears,
  StoredActivitySeason
} from '../../domain/adventure-guild/index.js'
import type { SeasonBackfillJob } from '../../domain/character-timeline/index.js'

export type AdventureActivityRead = {
  characters: TimelineCharacter[]
  activity: AdventureActivityOf<StoredActivitySeason>
}

export type AdventureSeasonBackfillRead = {
  characters: TimelineCharacter[]
  season: StoredActivitySeason
  jobs: SeasonBackfillJob[]
}

export interface AdventureGuildRepository {
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
