import {
  type CharacterTimelineItemRow,
  type DatabaseClient,
  type StoredSeason,
  type TimelineCharacter,
  type TimelineEventRow,
  type TimelineRange,
  readAdventureCharacters,
  readCharactersTimelineEvents,
  readCharactersTimelineItems,
  readSeasonBackfillStates,
  readSeasons
} from '@dfragon/database'
import { addHours } from 'date-fns'
import { z } from 'zod'
import {
  ACQUISITION_CODES,
  CLEAR_CODES,
  ENHANCEMENT_CODES,
  type TimelineClear,
  type TimelineEnhancement
} from '../domain/character-timeline/project.js'
import {
  parseTimelineClearRow,
  parseTimelineEnhancementRow
} from '../infrastructure/database/character-timeline-read.js'
import {
  type SeasonBackfillJob,
  type SeasonBackfillProgress,
  isSeasonBackfilled,
  toSeasonBackfillJobs,
  toSeasonBackfillProgress,
  toSeasonBackfillRange,
  toSeasonTimelineStart
} from '../application/character-timeline/season-backfill.js'
import { formatResetDate, formatSeoulTime, parseResetDate } from '../utils/seoul-time.js'

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
// Neople 타임라인은 한 레이드의 본 레이드와 개전, 매칭 같은 단계를 같은 raidName으로 주고 data.modeName으로만 나눈다.
// 표에 없는 modeName은 본 레이드로 보고 하드, 일반으로 나눈다. 값은 운영 DB에서 본 modeName이다(2026-11-09).
const RAID_STAGE_LABELS = new Map([
  ['미카엘라 : 균열서', '싱글/매칭'],
  ['디레지에 : 서막', '매칭'],
  ['무의지의 장벽', '싱글/매칭'],
  ['무의 장막', '개전'],
  ['개전', '개전']
])
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

type AdventureActivityOf<Season> = SeasonActivity & {
  seasons: Season[]
  season: ActivitySeasonRange | null
}

export type AdventureActivity = AdventureActivityOf<ActivitySeason>

export type AdventureActivityRead = {
  characters: TimelineCharacter[]
  activity: AdventureActivityOf<StoredActivitySeason>
}

export type AdventureSeasonBackfillRead = {
  characters: TimelineCharacter[]
  season: StoredActivitySeason
  jobs: SeasonBackfillJob[]
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
    .map(({ id, name, startsAt }) => ({
      id,
      name,
      startsAt,
      available: isCollectedSeason(id)
    }))
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

function countName(counts: Map<string, NameCount>, name: string): void {
  const counted = counts.get(name) ?? { name, count: 0 }
  counted.count++
  counts.set(name, counted)
}

export function toRaidStageLabel({
  modeName,
  hard
}: Pick<TimelineClear, 'modeName' | 'hard'>): string | null {
  if (modeName === null) {
    return null
  }

  const stageLabel = RAID_STAGE_LABELS.get(modeName)
  if (stageLabel !== undefined) {
    return stageLabel
  }

  const difficultyLabel = hard ? '하드' : '일반'

  return difficultyLabel
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

  for (const clear of records.clears.flatMap(parseTimelineClearRow).filter(inSeason)) {
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
    for (const attempt of parseTimelineEnhancementRow(row)) {
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
  const raidCounts = new Map<string, RaidCount>()
  const legionCounts = new Map<string, NameCount>()
  for (const clear of records.clears.flatMap(parseTimelineClearRow).filter(onDay)) {
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
    .flatMap(parseTimelineEnhancementRow)
    .map(({ occurredAt, kind, after, result }): ActivityDayEnhancement => {
      const at = formatActivityTime(occurredAt)

      return { at, kind, target: after, success: result }
    })
  const raids = toNameCounts(raidCounts, RAID_RELEASE_ORDER)
  const legions = toNameCounts(legionCounts, LEGION_RELEASE_ORDER)

  return { date: day.date, raids, legions, items, enhancements }
}

export function toSeasonDays(records: ActivityRecords): ActivityDayDetail[] {
  const days = new Map<string, { clears: TimelineEventRow[]; items: CharacterTimelineItemRow[] }>()
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
    return { characters, activity: { seasons, season: null, ...emptySeasonActivity() } }
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
  const days = toSeasonDays(records)

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
