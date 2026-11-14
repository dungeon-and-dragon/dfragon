import {
  type CharacterTimelineItemRow,
  type DatabaseClient,
  type TimelineCharacter,
  type TimelineEventRow,
  type TimelineRange,
  readAdventureCharacters,
  readCharactersTimelineEvents,
  readCharactersTimelineItems,
  readSeasonBackfillStates,
  readSeasons
} from '@dfragon/database'
import type {
  AdventureActivityRead,
  AdventureSeasonBackfillRead
} from '../../application/adventure-guild/repository.js'
import {
  type ActivityDayDetail,
  type ActivityDayRange,
  type ActivityRecords as ParsedActivityRecords,
  type ActivitySeasonRange,
  type AdventureSeasonDays,
  type SeasonActivity,
  emptySeasonActivity,
  findActivitySeason,
  toActivityDayDetail,
  toActivitySeasons,
  toSeasonActivity,
  toSeasonBackfillRanges,
  toSeasonDays,
  withSeasonBackfills
} from '../../domain/adventure-guild/activity.js'
import {
  ACQUISITION_CODES,
  CLEAR_CODES,
  ENHANCEMENT_CODES
} from '../../domain/character-timeline/project.js'
import {
  type SeasonBackfillProgress,
  isSeasonBackfilled,
  toSeasonBackfillJobs,
  toSeasonBackfillProgress
} from '../../domain/character-timeline/season-backfill.js'
import { parseTimelineClearRow, parseTimelineEnhancementRow } from './character-timeline-read.js'

export type ActivityRecords = {
  clears: readonly TimelineEventRow[]
  items: readonly CharacterTimelineItemRow[]
}

function parseActivityRecords(records: ActivityRecords): ParsedActivityRecords {
  const clears = records.clears.flatMap(parseTimelineClearRow)
  const items = records.items.map((row) => {
    const enhancements = parseTimelineEnhancementRow(row)

    return { ...row, enhancements }
  })

  return { clears, items }
}

export function parseSeasonActivity(
  season: ActivitySeasonRange,
  records: ActivityRecords
): SeasonActivity {
  return toSeasonActivity(season, parseActivityRecords(records))
}

export function parseActivityDayDetail(
  day: ActivityDayRange,
  records: ActivityRecords
): ActivityDayDetail {
  return toActivityDayDetail(day, parseActivityRecords(records))
}

export function parseSeasonDays(records: ActivityRecords): ActivityDayDetail[] {
  return toSeasonDays(parseActivityRecords(records))
}

async function readActivityRecords(
  client: DatabaseClient,
  characters: readonly TimelineCharacter[],
  since: Date,
  until: Date | undefined
): Promise<ActivityRecords> {
  const [clears, items] = await Promise.all([
    readCharactersTimelineEvents(client, characters, CLEAR_CODES, since, until),
    readCharactersTimelineItems(
      client,
      characters,
      [...ENHANCEMENT_CODES, ...ACQUISITION_CODES],
      since,
      until
    )
  ])

  return { clears, items }
}

async function readSeasonActivity(
  client: DatabaseClient,
  characters: readonly TimelineCharacter[],
  season: ActivitySeasonRange
): Promise<SeasonActivity> {
  const records = await readActivityRecords(
    client,
    characters,
    season.startsAt,
    season.endsAt ?? undefined
  )

  return parseSeasonActivity(season, records)
}

async function readSeasonBackfills(
  client: DatabaseClient,
  characters: readonly TimelineCharacter[],
  ranges: ReadonlyMap<number, TimelineRange>
): Promise<Map<number, SeasonBackfillProgress>> {
  const backfills = await Promise.all(
    [...ranges].map(async ([seasonId, range]) => {
      const states = await readSeasonBackfillStates(client, characters, seasonId)

      return [seasonId, toSeasonBackfillProgress(range, characters.length, states)] as const
    })
  )

  return new Map(backfills)
}

async function readActivitySeasonContext(
  client: DatabaseClient,
  adventureName: string,
  seasonId: number | undefined,
  now: Date
) {
  const startedSeasons = toActivitySeasons(await readSeasons(client), now)
  const season = findActivitySeason(startedSeasons, seasonId)
  if (season === undefined && seasonId !== undefined) {
    return undefined
  }
  const characters = await readAdventureCharacters(client, adventureName)
  const backfills = await readSeasonBackfills(
    client,
    characters,
    toSeasonBackfillRanges(startedSeasons)
  )
  const seasons = withSeasonBackfills(startedSeasons, backfills)

  return { characters, seasons, season }
}

export async function readAdventureActivity(
  client: DatabaseClient,
  adventureName: string,
  seasonId: number | undefined,
  now: Date
): Promise<AdventureActivityRead | undefined> {
  const context = await readActivitySeasonContext(client, adventureName, seasonId, now)
  if (context === undefined) {
    return undefined
  }
  const { characters, seasons, season } = context
  if (season === undefined) {
    const activity = emptySeasonActivity()

    return { characters, activity: { seasons, season: null, ...activity } }
  }
  const available = seasons.some(({ id, available }) => id === season.id && available)
  const activity = available
    ? await readSeasonActivity(client, characters, season)
    : emptySeasonActivity()

  return { characters, activity: { seasons, season, ...activity } }
}

export async function readAdventureSeasonDays(
  client: DatabaseClient,
  adventureName: string,
  seasonId: number,
  now: Date
): Promise<AdventureSeasonDays | undefined> {
  const context = await readActivitySeasonContext(client, adventureName, seasonId, now)
  if (context === undefined || context.season === undefined) {
    return undefined
  }
  const { characters, seasons, season } = context
  const available = seasons.some(({ id, available }) => id === season.id && available)
  if (!available) {
    return { season: season.id, days: [] }
  }
  const records = await readActivityRecords(
    client,
    characters,
    season.startsAt,
    season.endsAt ?? now
  )
  const days = parseSeasonDays(records)

  return { season: season.id, days }
}

export async function readAdventureSeasonBackfill(
  client: DatabaseClient,
  adventureName: string,
  seasonId: number,
  now: Date
): Promise<AdventureSeasonBackfillRead | undefined> {
  const seasons = toActivitySeasons(await readSeasons(client), now)
  const range = toSeasonBackfillRanges(seasons).get(seasonId)
  const season = seasons.find(({ id }) => id === seasonId)
  if (range === undefined || season === undefined) {
    return undefined
  }
  const characters = await readAdventureCharacters(client, adventureName)
  const states = await readSeasonBackfillStates(client, characters, seasonId)
  const backfill = toSeasonBackfillProgress(range, characters.length, states)
  const available = isSeasonBackfilled(backfill)
  const jobs = toSeasonBackfillJobs(characters, seasonId, range, states)

  return { characters, season: { ...season, available, backfill }, jobs }
}
