import type { StoredSeason, TimelineRange } from '@dfragon/database'
import { addHours } from 'date-fns'
import { z } from 'zod'
import {
  ACQUISITION_CODES,
  type TimelineClear,
  type TimelineEnhancement
} from '../character-timeline/project.js'
import {
  type SeasonBackfillProgress,
  isSeasonBackfilled,
  toSeasonBackfillRange,
  toSeasonTimelineStart
} from '../character-timeline/season-backfill.js'
import { formatResetDate, formatSeoulTime, parseResetDate } from '../seoul-time.js'
import { toRaidStageLabel } from '../raid-stage.js'

// 타임라인 정기 동기화는 중천(시즌 10)부터 받는다. 그 전 시즌은 모험단 캐릭터가 모두 옛 시즌 받기를 끝내야 집계한다.
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
// data.ticket은 강화권, 증폭권을 쓴 기록에만 있다. 운영 DB에서는 객체지만 안의 키를 확인하지 못해 값이 있는지만 본다.
// 권은 그 단계에 직접 도전한 기록이 아니라 단계별 성공률에서 뺀다.
const ticketData = z.object({ ticket: z.unknown().refine((ticket) => ticket != null) })
// 출시가 최근인 것부터다(2026-11-07 저장소 소유자 결정). 새 레이드, 레기온은 맨 앞에 더한다.
export const RAID_RELEASE_ORDER = [
  '무너진 성자 미카엘라 (하드)',
  '무너진 성자 미카엘라 (일반)',
  '무너진 성자 미카엘라 (싱글/매칭)',
  '디레지에 레이드 (하드)',
  '디레지에 레이드 (일반)',
  '디레지에 레이드 (매칭)',
  '이내 황혼전',
  '만들어진 신 나벨 (하드)',
  '만들어진 신 나벨 (일반)',
  '만들어진 신 나벨 (싱글/매칭)',
  '아스라한 (하드)',
  '아스라한 (일반)',
  '아스라한 (개전)',
  '기계 혁명 (하드)',
  '기계 혁명 (일반)',
  '기계 혁명 (개전)',
  '혼돈의 오즈마',
  '무형의 시로코',
  '프레이-이시스',
  '핀드워',
  '루크',
  '안톤'
] as const
export const LEGION_RELEASE_ORDER = [
  '아포칼립스',
  '베누스',
  '깨어난 숲(극)',
  '깨어난 숲(일반)',
  '어둑섬',
  '차원회랑',
  '이스핀즈'
] as const
const ACTIVITY_DAY_HOURS = 24
const ACTIVITY_TIME_PATTERN = "yyyy-MM-dd'T'HH:mm:ssxxx"

type ItemRarityName = keyof typeof ITEM_RARITIES
type ItemRarity = (typeof ITEM_RARITIES)[ItemRarityName]

export type SeasonBackfillStatus = SeasonBackfillProgress & { running: boolean }

type ActivitySeasonOf<Backfill> = {
  id: number
  name: string
  startsAt: Date
  available: boolean
  backfill?: Backfill
}

export type StoredActivitySeason = ActivitySeasonOf<SeasonBackfillProgress>

export type ActivitySeason = ActivitySeasonOf<SeasonBackfillStatus>

export type ActivitySeasonRange = {
  id: number
  startsAt: Date
  endsAt: Date | null
  timelineStartsAt: Date
}

export type NameCount = {
  name: string
  count: number
}

export type RaidCount = NameCount & {
  hard: number
  normal: number
}

export type EnhancementTarget = {
  target: number
  attempts: number
  successes: number
}

export type ActivitySummary = {
  raids: RaidCount[]
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

export type AdventureActivityOf<Season> = SeasonActivity & {
  seasons: Season[]
  season: ActivitySeasonRange | null
}

export type AdventureActivity = AdventureActivityOf<ActivitySeason>

export type ActivityItem = {
  code: number
  occurredAt: Date
  itemName: string | null
  itemRarity: string | null
  data: unknown
  enhancements: TimelineEnhancement[]
}

export type ActivityRecords = {
  clears: readonly TimelineClear[]
  items: readonly ActivityItem[]
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
  raids: RaidCount[]
  legions: NameCount[]
  items: ActivityDayItem[]
  enhancements: ActivityDayEnhancement[]
}

export type AdventureSeasonDays = {
  season: number
  days: ActivityDayDetail[]
}

function isCollectedSeason(id: number): boolean {
  return id >= FIRST_COLLECTED_SEASON_ID
}

export function toActivitySeasons(
  seasons: readonly StoredSeason[],
  now: Date
): StoredActivitySeason[] {
  return seasons
    .filter(({ startsAt }) => startsAt <= now)
    .map(({ id, name, startsAt }) => {
      const available = isCollectedSeason(id)

      return { id, name, startsAt, available }
    })
}

export function findActivitySeason(
  seasons: readonly StoredActivitySeason[],
  seasonId: number | undefined
): ActivitySeasonRange | undefined {
  const index =
    seasonId !== undefined ? seasons.findIndex(({ id }) => id === seasonId) : seasons.length - 1
  const season = seasons[index]
  if (season === undefined) {
    return undefined
  }
  const endsAt = seasons[index + 1]?.startsAt ?? null
  const timelineStartsAt = toSeasonTimelineStart(season.startsAt)

  return { id: season.id, startsAt: season.startsAt, endsAt, timelineStartsAt }
}

// 다음 시즌이 시작한 중천 전 시즌만 받을 수 있다.
export function toSeasonBackfillRanges(
  seasons: readonly StoredActivitySeason[]
): Map<number, TimelineRange> {
  const ranges = new Map<number, TimelineRange>()
  for (const [index, { id, startsAt }] of seasons.entries()) {
    const next = seasons[index + 1]
    if (!isCollectedSeason(id) && next !== undefined) {
      ranges.set(id, toSeasonBackfillRange(startsAt, next.startsAt))
    }
  }

  return ranges
}

export function withSeasonBackfills(
  seasons: readonly StoredActivitySeason[],
  backfills: ReadonlyMap<number, SeasonBackfillProgress>
): StoredActivitySeason[] {
  return seasons.map((season) => {
    const backfill = backfills.get(season.id)
    if (backfill === undefined) {
      return season
    }
    const available = isSeasonBackfilled(backfill)

    return { ...season, available, backfill }
  })
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

function toItemRarityName({ code, itemRarity }: ActivityItem): ItemRarityName | undefined {
  if (!ITEM_CODES.has(code) || itemRarity === null || !isItemRarityName(itemRarity)) {
    return undefined
  }

  return itemRarity
}

function usedTicket({ data }: ActivityItem): boolean {
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
  const summary = emptySummary()

  return { summary, days: [] }
}

function countName(counts: Map<string, NameCount>, name: string): void {
  const counted = counts.get(name) ?? { name, count: 0 }
  counted.count++
  counts.set(name, counted)
}

function toRaidCountName(clear: TimelineClear): string {
  const label = toRaidStageLabel(clear)
  if (label === null) {
    return clear.name
  }

  return `${clear.name} (${label})`
}

function countRaid(counts: Map<string, RaidCount>, clear: TimelineClear): void {
  const name = toRaidCountName(clear)
  const raid = counts.get(name) ?? { name, count: 0, hard: 0, normal: 0 }
  raid.count++
  if (clear.hard) {
    raid.hard++
  } else {
    raid.normal++
  }
  counts.set(name, raid)
}

function toNameCounts<Count extends NameCount>(
  counts: ReadonlyMap<string, Count>,
  releaseOrder: readonly string[]
): Count[] {
  const releaseRank = ({ name }: NameCount): number => {
    const rank = releaseOrder.indexOf(name)
    if (rank === -1) {
      return releaseOrder.length
    }

    return rank
  }

  return [...counts.values()].sort(
    (a, b) => releaseRank(a) - releaseRank(b) || b.count - a.count || (a.name < b.name ? -1 : 1)
  )
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
  const raids = new Map<string, RaidCount>()
  const legions = new Map<string, NameCount>()
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

  for (const clear of records.clears.filter(inSeason)) {
    const day = dayOf(clear.occurredAt)
    if (clear.kind === 'raid') {
      countRaid(raids, clear)
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
    for (const attempt of row.enhancements) {
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

  summary.raids = toNameCounts(raids, RAID_RELEASE_ORDER)
  summary.legions = toNameCounts(legions, LEGION_RELEASE_ORDER)
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

  const endsAt = addHours(startsAt, ACTIVITY_DAY_HOURS)

  return { date, startsAt, endsAt }
}

function formatActivityTime(occurredAt: Date): string {
  return formatSeoulTime(occurredAt, ACTIVITY_TIME_PATTERN)
}

export function toActivityDayDetail(
  day: ActivityDayRange,
  records: ActivityRecords
): ActivityDayDetail {
  const onDay = (record: { occurredAt: Date }) => occursIn(day, record)
  const raidCounts = new Map<string, RaidCount>()
  const legionCounts = new Map<string, NameCount>()
  for (const clear of records.clears.filter(onDay)) {
    if (clear.kind === 'raid') {
      countRaid(raidCounts, clear)
    } else {
      countName(legionCounts, clear.name)
    }
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
    .flatMap((row) => row.enhancements)
    .map(({ occurredAt, kind, after, result }): ActivityDayEnhancement => {
      const at = formatActivityTime(occurredAt)

      return { at, kind, target: after, success: result }
    })
  const raids = toNameCounts(raidCounts, RAID_RELEASE_ORDER)
  const legions = toNameCounts(legionCounts, LEGION_RELEASE_ORDER)

  return { date: day.date, raids, legions, items, enhancements }
}

export function toSeasonDays(records: ActivityRecords): ActivityDayDetail[] {
  const days = new Map<string, { clears: TimelineClear[]; items: ActivityItem[] }>()
  const recordsFor = (occurredAt: Date) => {
    const date = formatResetDate(occurredAt)
    const dayRecords = days.get(date) ?? { clears: [], items: [] }
    days.set(date, dayRecords)

    return dayRecords
  }
  for (const clear of records.clears) {
    recordsFor(clear.occurredAt).clears.push(clear)
  }
  for (const item of records.items) {
    recordsFor(item.occurredAt).items.push(item)
  }

  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([date, dayRecords]) => {
      const day = toActivityDayRange(date)
      if (day === undefined) {
        throw new Error('Invalid activity day')
      }
      const detail = toActivityDayDetail(day, dayRecords)
      const isEmpty =
        detail.raids.length +
          detail.legions.length +
          detail.items.length +
          detail.enhancements.length ===
        0
      if (isEmpty) {
        return []
      }

      return [detail]
    })
}
