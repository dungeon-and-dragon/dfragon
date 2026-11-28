import type {
  CharacterEquipmentSet,
  CharacterOathSet,
  RankedStoredCharacter,
  StoredGuild
} from '@dfragon/database'
import { z } from 'zod'
import {
  ADVENTURE_TIMELINE_KINDS,
  parseAdventureTimelineCursor,
  type ActivitySeason,
  type AdventureActivity,
  type AdventureSeasonDays,
  type AdventureTimelinePage,
  type AdventureTimelineQuery,
  type AdventureWeeklyClears,
  type SelectedAdventureEquipment
} from '#domain/adventure-guild/index.js'
import { CharacterDetailFailure } from '@dfragon/server-core/domain/character-failure.js'
import { type CharacterRow, toCharacterRow } from '#domain/character-row.js'

const SEASON_NUMBER_PATTERN = /^[1-9]\d{0,3}$/
const seasonNumber = z.string().regex(SEASON_NUMBER_PATTERN).transform(Number)

export const activityQuery = z.object({ season: seasonNumber.optional() })

export const equipmentQuery = z.object({
  server: z.string().optional(),
  set: z.string().optional()
})

const timelineQuery = z
  .object({ kind: z.enum(ADVENTURE_TIMELINE_KINDS).optional(), before: z.string().optional() })
  .strict()

export type ActivityQuery = z.infer<typeof activityQuery>

export type SeasonNumber = z.infer<typeof seasonNumber>

export type AdventureCharactersResponse = {
  adventureName: string
  characters: (CharacterRow & {
    equipmentSet: CharacterEquipmentSet | null
    oathSet: CharacterOathSet | null
  })[]
}

export type GuildMembersResponse = {
  guildId: string
  guildName: string | null
  memberCount: number
  members: CharacterRow[]
}

export type AdventureWeeklyResponse = AdventureWeeklyClears & { adventureName: string }

export type AdventureEquipmentResponse = SelectedAdventureEquipment & { adventureName: string }

export type AdventureActivityResponse = AdventureActivity

export type AdventureSeasonDaysResponse = AdventureSeasonDays

export type ActivitySeasonResponse = ActivitySeason

export type AdventureTimelineResponse = AdventureTimelinePage

export function parseTimelineQuery(query: unknown): AdventureTimelineQuery {
  const parsed = timelineQuery.safeParse(query)

  if (!parsed.success) {
    throw new CharacterDetailFailure('query')
  }

  const { kind, before } = parsed.data

  if (before === undefined) {
    return { kind }
  }

  const cursor = parseAdventureTimelineCursor(before)

  if (cursor === undefined) {
    throw new CharacterDetailFailure('query')
  }

  return { kind, before: cursor }
}

export function parseSeason(season: string): SeasonNumber {
  const parsed = seasonNumber.safeParse(season)

  if (!parsed.success) {
    throw new CharacterDetailFailure('query')
  }

  return parsed.data
}

export function toAdventureCharactersResponse(
  adventureName: string,
  characters: readonly RankedStoredCharacter[]
): AdventureCharactersResponse {
  const rows = characters.map(({ equipmentSet, oathSet, ...stored }) => {
    const row = toCharacterRow(stored)

    return { ...row, equipmentSet, oathSet }
  })

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
  equipment: SelectedAdventureEquipment
): AdventureEquipmentResponse {
  return { adventureName, ...equipment }
}

export function toAdventureWeeklyResponse(
  adventureName: string,
  weekly: AdventureWeeklyClears
): AdventureWeeklyResponse {
  return { adventureName, ...weekly }
}
