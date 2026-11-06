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
import { addHours } from 'date-fns'
import { z } from 'zod'
import {
  ACQUISITION_CODES,
  CLEAR_CODES,
  ENHANCEMENT_CODES,
  type TimelineEnhancement,
  toClear,
  toEnhancement
} from '../characters/timeline/read.js'
import { formatResetDate, formatSeoulTime, parseResetDate } from '../utils/seoul-time.js'

// 타임라인은 중천(시즌 10)부터 받는다. 그 전 시즌에는 강화 백필 행만 있어 집계하지 않는다.
const FIRST_COLLECTED_SEASON_ID = 10
const HIGH_AMPLIFY_TARGET = 10
const HIGH_REINFORCE_TARGET = 12
const ITEM_RARITIES = {
  레전더리: 'legendary',
  에픽: 'epic',
  태초: 'primeval',
  신화: 'mythic'
} as const
const ITEM_CODES = new Set(ACQUISITION_CODES)
// data.ticket은 강화권, 증폭권처럼 쓴 아이템 이름이다. 권은 그 단계에 직접 도전한 기록이 아니라 단계별 성공률에서 뺀다.
const ticketData = z.object({ ticket: z.string().min(1) })
const ACTIVITY_DAY_HOURS = 24
const ACTIVITY_TIME_PATTERN = "yyyy-MM-dd'T'HH:mm:ssxxx"

type ItemRarityName = keyof typeof ITEM_RARITIES
type ItemRarity = (typeof ITEM_RARITIES)[ItemRarityName]

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

export type ActivityDayRange = {
  date: string
  startsAt: Date
  endsAt: Date
}

export type ActivityDayItem = {
  at: string
  name: string | null
  rarity: ItemRarityName
}

export type ActivityDayEnhancement = {
  at: string
  kind: TimelineEnhancement['kind']
  target: number
  success: boolean
}

export type ActivityDayDetail = {
  date: string
  raids: NameCount[]
  legions: NameCount[]
  items: ActivityDayItem[]
  enhancements: ActivityDayEnhancement[]
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

function occursIn(
  { startsAt, endsAt }: { startsAt: Date; endsAt: Date | null },
  { occurredAt }: { occurredAt: Date }
): boolean {
  return occurredAt >= startsAt && (endsAt === null || occurredAt < endsAt)
}

function isItemRarityName(name: string): name is ItemRarityName {
  return Object.hasOwn(ITEM_RARITIES, name)
}

function toItemRarityName({
  code,
  itemRarity
}: CharacterTimelineItemRow): ItemRarityName | undefined {
  if (!ITEM_CODES.has(code) || itemRarity === null || !isItemRarityName(itemRarity)) {
    return undefined
  }

  return itemRarity
}

function usedTicket({ data }: CharacterTimelineItemRow): boolean {
  return ticketData.safeParse(data).success
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
  const inSeason = (record: { occurredAt: Date }) => occursIn(season, record)
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
    const rarityName = toItemRarityName(row)
    if (rarityName !== undefined) {
      const rarity = ITEM_RARITIES[rarityName]
      const day = dayOf(row.occurredAt)
      items[rarity]++
      day.item++
      day.primeval ||= rarity === 'primeval'
      day.mythic ||= rarity === 'mythic'
    }

    const ticket = usedTicket(row)
    for (const attempt of toEnhancement(row)) {
      const day = dayOf(attempt.occurredAt)
      enhancement.attempts++
      day.enhance++
      day.highEnhancement ||= isHighEnhancement(attempt)
      if (attempt.kind === 'refine') {
        enhancement.refine++
      } else if (attempt.kind === 'amplify' && attempt.after >= HIGH_AMPLIFY_TARGET) {
        if (!ticket) {
          countTarget(amplify, attempt)
        }
      } else if (attempt.kind === 'amplify') {
        enhancement.amplifyBelow10++
      } else if (attempt.after >= HIGH_REINFORCE_TARGET) {
        if (!ticket) {
          countTarget(reinforce, attempt)
        }
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

export function toActivityDayRange(date: string): ActivityDayRange | undefined {
  const startsAt = parseResetDate(date)
  if (startsAt === null) {
    return undefined
  }

  return { date, startsAt, endsAt: addHours(startsAt, ACTIVITY_DAY_HOURS) }
}

function formatActivityTime(occurredAt: Date): string {
  return formatSeoulTime(occurredAt, ACTIVITY_TIME_PATTERN)
}

export function toActivityDayDetail(
  day: ActivityDayRange,
  records: ActivityRecords
): ActivityDayDetail {
  const onDay = (record: { occurredAt: Date }) => occursIn(day, record)
  const raidCounts = new Map<string, number>()
  const legionCounts = new Map<string, number>()
  for (const clear of records.clears.flatMap(toClear).filter(onDay)) {
    countName(clear.kind === 'raid' ? raidCounts : legionCounts, clear.name)
  }
  const rows = records.items
    .filter(onDay)
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
  const items = rows.flatMap((row): ActivityDayItem[] => {
    const rarity = toItemRarityName(row)
    if (rarity === undefined) {
      return []
    }

    const at = formatActivityTime(row.occurredAt)

    return [{ at, name: row.itemName, rarity }]
  })
  const enhancements = rows
    .flatMap(toEnhancement)
    .map(({ occurredAt, kind, after, result }): ActivityDayEnhancement => {
      const at = formatActivityTime(occurredAt)

      return { at, kind, target: after, success: result }
    })
  const raids = toNameCounts(raidCounts)
  const legions = toNameCounts(legionCounts)

  return { date: day.date, raids, legions, items, enhancements }
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

  return toSeasonActivity(season, records)
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

export async function readAdventureActivityDay(
  client: DatabaseClient,
  adventureName: string,
  day: ActivityDayRange
): Promise<ActivityDayDetail> {
  const characters = await readAdventureCharacters(client, adventureName)
  const records = await readActivityRecords(client, characters, day.startsAt, day.endsAt)

  return toActivityDayDetail(day, records)
}
