import type { StoredCharacter, StoredGuild } from '@dfragon/database'
import { z } from 'zod'
import type {
  ActivitySeason,
  AdventureActivity,
  AdventureEquipment,
  AdventureSeasonDays,
  AdventureWeeklyClears
} from '#domain/adventure-guild/index.js'
import { CharacterDetailFailure } from '@dfragon/server-core/domain/character-failure.js'
import { type CharacterRow, toCharacterRow } from '#domain/character-row.js'

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
  members: CharacterRow[]
}

export type AdventureWeeklyResponse = AdventureWeeklyClears & { adventureName: string }

export type AdventureEquipmentResponse = AdventureEquipment & { adventureName: string }

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
  const rows = members.map(toCharacterRow)

  return { guildId, guildName, memberCount, members: rows }
}

export function toAdventureEquipmentResponse(
  adventureName: string,
  equipment: AdventureEquipment
): AdventureEquipmentResponse {
  return { adventureName, ...equipment }
}

export function toAdventureWeeklyResponse(
  adventureName: string,
  weekly: AdventureWeeklyClears
): AdventureWeeklyResponse {
  return { adventureName, ...weekly }
}
