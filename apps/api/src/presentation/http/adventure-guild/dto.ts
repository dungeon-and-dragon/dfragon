import type { StoredCharacter, StoredGuild } from '@dfragon/database'
import { z } from 'zod'
import type {
  ActivitySeason,
  AdventureActivity,
  AdventureSeasonDays
} from '../../../domain/adventure-guild/activity.js'
import { averageFame } from '../../../domain/adventure-guild/fame.js'
import type { AdventureWeeklyClears } from '../../../domain/adventure-guild/weekly.js'
import { CharacterDetailFailure } from '../../../domain/character-failure.js'
import { type CharacterRow, toCharacterRow } from '../../../domain/character-row.js'

const SEASON_NUMBER_PATTERN = /^[1-9]\d{0,3}$/
const seasonNumber = z.string().regex(SEASON_NUMBER_PATTERN).transform(Number)

export const activityQuery = z.object({ season: seasonNumber.optional() })

export type ActivityQuery = z.infer<typeof activityQuery>

export type SeasonNumber = z.infer<typeof seasonNumber>

export type AdventureCharactersResponse = {
  adventureName: string
  characters: CharacterRow[]
}

export type GuildMembersResponse = {
  guildId: string
  guildName: string | null
  memberCount: number
  averageFame: number | null
  members: CharacterRow[]
}

export type AdventureWeeklyResponse = AdventureWeeklyClears & { adventureName: string }

export type AdventureActivityResponse = AdventureActivity

export type AdventureSeasonDaysResponse = AdventureSeasonDays

export type ActivitySeasonResponse = ActivitySeason

export function parseSeason(season: string): SeasonNumber {
  const parsed = seasonNumber.safeParse(season)

  if (!parsed.success) {
    throw new CharacterDetailFailure('query')
  }

  return parsed.data
}

export function toAdventureCharactersResponse(
  adventureName: string,
  characters: readonly StoredCharacter[]
): AdventureCharactersResponse {
  const rows = characters.map(toCharacterRow)

  return { adventureName, characters: rows }
}

export function toGuildMembersResponse(
  guildId: string,
  { guildName, members }: StoredGuild
): GuildMembersResponse {
  const memberCount = members.length
  const meanFame = averageFame(members)
  const rows = members.map(toCharacterRow)

  return { guildId, guildName, memberCount, averageFame: meanFame, members: rows }
}

export function toAdventureWeeklyResponse(
  adventureName: string,
  weekly: AdventureWeeklyClears
): AdventureWeeklyResponse {
  return { adventureName, ...weekly }
}
