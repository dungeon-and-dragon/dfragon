import {
  type CharacterTimelineItemRow,
  type DatabaseClient,
  type StoredSeason,
  type TimelineCharacter,
  type TimelineEventRow,
  readAdventureCharacters,
  readCharactersTimelineEvents,
  readCharactersTimelineItems,
  readSeasons
} from '@dfragon/database'
import {
  ACQUISITION_CODES,
  CLEAR_CODES,
  ENHANCEMENT_CODES,
  type TimelineEnhancement,
  toClear,
  toEnhancement
} from '../characters/timeline/read.js'
import { formatResetDate } from '../utils/seoul-time.js'

// 타임라인은 중천(시즌 10)부터 받는다. 그 전 시즌에는 강화 백필 행만 있어 집계하지 않는다.
const FIRST_COLLECTED_SEASON_ID = 10
const HIGH_AMPLIFY_TARGET = 10
const HIGH_REINFORCE_TARGET = 12
const ITEM_RARITIES = new Map<string, ItemRarity>([
  ['레전더리', 'legendary'],
  ['에픽', 'epic'],
  ['태초', 'primeval'],
  ['신화', 'mythic']
])
const ITEM_CODES = new Set(ACQUISITION_CODES)

type ItemRarity = 'legendary' | 'epic' | 'primeval' | 'mythic'

export type ActivitySeason = {
  id: number
  name: string
  startsAt: Date
  available: boolean
}

export type ActivitySeasonRange = {
  id: number
  startsAt: Date
  endsAt: Date | null
}

export type NameCount = {
  name: string
  count: number
}

export type EnhancementTarget = {
  target: number
  attempts: number
  successes: number
}

export type ActivitySummary = {
  raids: NameCount[]
  legions: NameCount[]
  items: Record<ItemRarity, number>
  enhancement: {
    attempts: number
    amplify: EnhancementTarget[]
    reinforce: EnhancementTarget[]
    amplifyBelow10: number
    reinforceBelow12: number
    refine: number
  }
}

export type ActivityDay = {
  date: string
  raid: number
  legion: number
  item: number
  enhance: number
  primeval: boolean
  mythic: boolean
  highEnhancement: boolean
}

export type SeasonActivity = {
  summary: ActivitySummary
  days: ActivityDay[]
}

export type AdventureActivity = SeasonActivity & {
  seasons: ActivitySeason[]
  season: ActivitySeasonRange | null
}

export type AdventureActivityRead = {
  characters: TimelineCharacter[]
  activity: AdventureActivity
}

export type ActivityRecords = {
  clears: readonly TimelineEventRow[]
  items: readonly CharacterTimelineItemRow[]
}

function isCollectedSeason(id: number): boolean {
  return id >= FIRST_COLLECTED_SEASON_ID
}

export function toActivitySeasons(seasons: readonly StoredSeason[], now: Date): ActivitySeason[] {
  return seasons
    .filter(({ startsAt }) => startsAt <= now)
    .map(({ id, name, startsAt }) => ({
      id,
      name,
      startsAt,
      available: isCollectedSeason(id)
    }))
}

export function findActivitySeason(
  seasons: readonly ActivitySeason[],
  seasonId: number | undefined
): ActivitySeasonRange | undefined {
  const index =
    seasonId !== undefined ? seasons.findIndex(({ id }) => id === seasonId) : seasons.length - 1
  const season = seasons[index]
  if (season === undefined) {
    return undefined
  }
  const endsAt = seasons[index + 1]?.startsAt ?? null

  return { id: season.id, startsAt: season.startsAt, endsAt }
}

function emptySummary(): ActivitySummary {
  return {
    raids: [],
    legions: [],
    items: { legendary: 0, epic: 0, primeval: 0, mythic: 0 },
    enhancement: {
      attempts: 0,
      amplify: [],
      reinforce: [],
      amplifyBelow10: 0,
      reinforceBelow12: 0,
      refine: 0
    }
  }
}

export function emptySeasonActivity(): SeasonActivity {
  return { summary: emptySummary(), days: [] }
}

function countName(counts: Map<string, number>, name: string): void {
  counts.set(name, (counts.get(name) ?? 0) + 1)
}

function toNameCounts(counts: ReadonlyMap<string, number>): NameCount[] {
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : 1))
}

function countTarget(
  targets: Map<number, EnhancementTarget>,
  { after, result }: TimelineEnhancement
) {
  const target = targets.get(after) ?? { target: after, attempts: 0, successes: 0 }
  target.attempts++
  if (result) {
    target.successes++
  }
  targets.set(after, target)
}

function toTargets(targets: ReadonlyMap<number, EnhancementTarget>): EnhancementTarget[] {
  return [...targets.values()].sort((a, b) => a.target - b.target)
}

function isHighEnhancement({ kind, after }: TimelineEnhancement): boolean {
  if (kind === 'amplify') {
    return after >= HIGH_AMPLIFY_TARGET
  }

  return kind === 'reinforce' && after >= HIGH_REINFORCE_TARGET
}

export function toSeasonActivity(
  season: ActivitySeasonRange,
  records: ActivityRecords
): SeasonActivity {
  const inSeason = ({ occurredAt }: { occurredAt: Date }) =>
    occurredAt >= season.startsAt && (season.endsAt === null || occurredAt < season.endsAt)
  const summary = emptySummary()
  const { items, enhancement } = summary
  const raids = new Map<string, number>()
  const legions = new Map<string, number>()
  const amplify = new Map<number, EnhancementTarget>()
  const reinforce = new Map<number, EnhancementTarget>()
  const days = new Map<string, ActivityDay>()
  const dayOf = (occurredAt: Date): ActivityDay => {
    const date = formatResetDate(occurredAt)
    const day = days.get(date) ?? {
      date,
      raid: 0,
      legion: 0,
      item: 0,
      enhance: 0,
      primeval: false,
      mythic: false,
      highEnhancement: false
    }
    days.set(date, day)

    return day
  }

  for (const clear of records.clears.flatMap(toClear).filter(inSeason)) {
    const day = dayOf(clear.occurredAt)
    if (clear.kind === 'raid') {
      countName(raids, clear.name)
      day.raid++
    } else {
      countName(legions, clear.name)
      day.legion++
    }
  }

  for (const row of records.items.filter(inSeason)) {
    const rarity = ITEM_CODES.has(row.code) ? ITEM_RARITIES.get(row.itemRarity ?? '') : undefined
    if (rarity !== undefined) {
      const day = dayOf(row.occurredAt)
      items[rarity]++
      day.item++
      day.primeval ||= rarity === 'primeval'
      day.mythic ||= rarity === 'mythic'
    }

    for (const attempt of toEnhancement(row)) {
      const day = dayOf(attempt.occurredAt)
      enhancement.attempts++
      day.enhance++
      day.highEnhancement ||= isHighEnhancement(attempt)
      if (attempt.kind === 'refine') {
        enhancement.refine++
      } else if (attempt.kind === 'amplify' && attempt.after >= HIGH_AMPLIFY_TARGET) {
        countTarget(amplify, attempt)
      } else if (attempt.kind === 'amplify') {
        enhancement.amplifyBelow10++
      } else if (attempt.after >= HIGH_REINFORCE_TARGET) {
        countTarget(reinforce, attempt)
      } else {
        enhancement.reinforceBelow12++
      }
    }
  }

  summary.raids = toNameCounts(raids)
  summary.legions = toNameCounts(legions)
  enhancement.amplify = toTargets(amplify)
  enhancement.reinforce = toTargets(reinforce)

  const activeDays = [...days.values()].sort((a, b) => (a.date < b.date ? -1 : 1))

  return { summary, days: activeDays }
}

async function readSeasonActivity(
  client: DatabaseClient,
  characters: readonly TimelineCharacter[],
  season: ActivitySeasonRange
): Promise<SeasonActivity> {
  const until = season.endsAt ?? undefined
  const [clears, items] = await Promise.all([
    readCharactersTimelineEvents(client, characters, CLEAR_CODES, season.startsAt, until),
    readCharactersTimelineItems(
      client,
      characters,
      [...ENHANCEMENT_CODES, ...ACQUISITION_CODES],
      season.startsAt,
      until
    )
  ])

  return toSeasonActivity(season, { clears, items })
}

export async function readAdventureActivity(
  client: DatabaseClient,
  adventureName: string,
  seasonId: number | undefined,
  now: Date
): Promise<AdventureActivityRead | undefined> {
  const seasons = toActivitySeasons(await readSeasons(client), now)
  const season = findActivitySeason(seasons, seasonId)
  if (season === undefined && seasonId !== undefined) {
    return undefined
  }
  const characters = await readAdventureCharacters(client, adventureName)
  if (season === undefined) {
    return { characters, activity: { seasons, season: null, ...emptySeasonActivity() } }
  }
  const activity = isCollectedSeason(season.id)
    ? await readSeasonActivity(client, characters, season)
    : emptySeasonActivity()

  return { characters, activity: { seasons, season, ...activity } }
}
