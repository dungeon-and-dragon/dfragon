import {
  type DatabaseClient,
  type TimelineCharacter,
  type TimelineEventRow,
  type TimelineItemCursor,
  type TimelineItemRow,
  type RecentTimelineItemQuery,
  readCurrentSeasonStart,
  readRecentTimelineItems,
  readTimelineEvents
} from '@dfragon/database'
import { z } from 'zod'
import { startOfResetWeek } from '../../utils/seoul-time.js'

export const RAID_CLEAR_CODES = [201, 210]
const LEGION_CLEAR_CODE = 209
export const CLEAR_CODES = [...RAID_CLEAR_CODES, LEGION_CLEAR_CODE]
type ClearKind = 'raid' | 'legion'
type EnhancementKind = 'reinforce' | 'amplify' | 'refine'

const ENHANCEMENT_KINDS = new Map<number, EnhancementKind>([
  [401, 'reinforce'],
  [402, 'amplify'],
  [403, 'refine']
])
export const ENHANCEMENT_CODES = [...ENHANCEMENT_KINDS.keys()]
export const ACQUISITION_CODES = [
  501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 511, 512, 513, 514, 515, 516, 517, 518, 519,
  520, 521, 550, 551, 552, 553, 554, 555, 556, 557
]
const ACQUISITION_RARITIES = ['에픽', '태초']
const PAGE_SIZE = 50
// 15자리 ms는 언제나 올바른 Date이고, 18자리 id는 PostgreSQL bigint 범위를 넘지 않는다.
const CURSOR_PATTERN = /^(\d{1,15})\.(\d{1,18})$/

export type TimelineClear = {
  kind: ClearKind
  name: string
  modeName: string | null
  hard: boolean
  occurredAt: Date
}

export type TimelineClearCount = {
  kind: ClearKind
  name: string
  hard: boolean
  count: number
}

export type TimelineEnhancement = {
  kind: EnhancementKind
  itemId: string | null
  itemName: string | null
  itemRarity: string | null
  before: number | null
  after: number
  result: boolean
  safe: boolean | null
  occurredAt: Date
}

export type TimelineAcquisition = {
  code: number
  name: string
  itemId: string | null
  itemName: string | null
  itemRarity: string | null
  occurredAt: Date
}

export type TimelinePageList = 'enhancements' | 'acquisitions'

export type TimelinePage<Item> = {
  items: Item[]
  nextCursor: string | null
}

export type TimelineItemPage = TimelinePage<TimelineEnhancement> | TimelinePage<TimelineAcquisition>

export type CharacterTimeline = {
  weeklyClears: TimelineClear[]
  seasonClears: TimelineClearCount[]
  enhancements: TimelineEnhancement[]
  enhancementsCursor: string | null
  acquisitions: TimelineAcquisition[]
  acquisitionsCursor: string | null
}

export type TimelineRecords = {
  clears: readonly TimelineEventRow[]
  enhancements: readonly TimelineItemRow[]
  acquisitions: readonly TimelineItemRow[]
}

export const EMPTY_CHARACTER_TIMELINE: CharacterTimeline = {
  weeklyClears: [],
  seasonClears: [],
  enhancements: [],
  enhancementsCursor: null,
  acquisitions: [],
  acquisitionsCursor: null
}

export const EMPTY_TIMELINE_PAGE: TimelineItemPage = { items: [], nextCursor: null }

const PAGE_QUERIES = {
  enhancements: { codes: ENHANCEMENT_CODES },
  acquisitions: { codes: ACQUISITION_CODES, itemRarities: ACQUISITION_RARITIES }
} satisfies Record<TimelinePageList, Pick<RecentTimelineItemQuery, 'codes' | 'itemRarities'>>

// 저장한 data는 Neople 응답의 객체지만 행마다 필드가 다를 수 있어 쓰기 전에 확인한다.
// Neople은 하드로 클리어한 레이드에만 hard: true를 넣고 나머지 행에는 칸을 두지 않는다.
const raidClearData = z.object({
  modeName: z.string().nullable().catch(null),
  hard: z.boolean().catch(false)
})
const legionClearData = z.object({ regionName: z.string() })
const enhancementData = z.object({
  before: z.number().nullable().catch(null),
  after: z.number(),
  result: z.boolean(),
  safe: z.boolean().nullable().catch(null)
})

export function toClear({ code, occurredAt, raidName, data }: TimelineEventRow): TimelineClear[] {
  if (code === LEGION_CLEAR_CODE) {
    const legion = legionClearData.safeParse(data)
    if (!legion.success) {
      return []
    }

    return [
      { kind: 'legion', name: legion.data.regionName, modeName: null, hard: false, occurredAt }
    ]
  }

  const raid = raidClearData.safeParse(data)
  if (raidName === null || !raid.success) {
    return []
  }

  const { modeName, hard } = raid.data

  return [{ kind: 'raid', name: raidName, modeName, hard, occurredAt }]
}

function countClears(clears: readonly TimelineClear[]): TimelineClearCount[] {
  const counts = new Map<string, TimelineClearCount>()
  for (const { kind, name, hard } of clears) {
    const key = `${kind}/${name}/${hard}`
    const count = counts.get(key)
    if (count === undefined) {
      counts.set(key, { kind, name, hard, count: 1 })
    } else {
      count.count++
    }
  }

  return [...counts.values()]
}

export function toEnhancement(row: TimelineItemRow): TimelineEnhancement[] {
  const kind = ENHANCEMENT_KINDS.get(row.code)
  const enhancement = enhancementData.safeParse(row.data)
  if (kind === undefined || !enhancement.success) {
    return []
  }
  const { before, after, result, safe } = enhancement.data

  return [
    {
      kind,
      itemId: row.itemId,
      itemName: row.itemName,
      itemRarity: row.itemRarity,
      before,
      after,
      result,
      safe,
      occurredAt: row.occurredAt
    }
  ]
}

function toAcquisition({
  code,
  name,
  itemId,
  itemName,
  itemRarity,
  occurredAt
}: TimelineItemRow): TimelineAcquisition {
  return { code, name, itemId, itemName, itemRarity, occurredAt }
}

export function formatTimelineCursor({ occurredAt, id }: TimelineItemCursor): string {
  return `${occurredAt.getTime()}.${id}`
}

export function parseTimelineCursor(cursor: string): TimelineItemCursor | undefined {
  const match = CURSOR_PATTERN.exec(cursor)
  if (match === null) {
    return undefined
  }

  return { occurredAt: new Date(Number(match[1])), id: BigInt(match[2]!) }
}

// 한 개를 더 읽어 다음 묶음이 있는지 본다. 형식이 맞지 않아 뺀 행이 있어도 cursor는 읽은 행으로 정한다.
function toPage<Item>(
  rows: readonly TimelineItemRow[],
  toItems: (rows: readonly TimelineItemRow[]) => Item[]
): TimelinePage<Item> {
  const page = rows.slice(0, PAGE_SIZE)
  const last = page.at(-1)
  const items = toItems(page)
  const nextCursor =
    rows.length > PAGE_SIZE && last !== undefined ? formatTimelineCursor(last) : null

  return { items, nextCursor }
}

function toEnhancementPage(rows: readonly TimelineItemRow[]): TimelinePage<TimelineEnhancement> {
  return toPage(rows, (page) => page.flatMap(toEnhancement))
}

function toAcquisitionPage(rows: readonly TimelineItemRow[]): TimelinePage<TimelineAcquisition> {
  return toPage(rows, (page) => page.map(toAcquisition))
}

export function toCharacterTimeline(
  records: TimelineRecords,
  weekStart: Date,
  seasonStart: Date
): CharacterTimeline {
  const clears = records.clears.flatMap(toClear)
  const weeklyClears = clears.filter(({ occurredAt }) => occurredAt >= weekStart)
  const seasonClears = countClears(clears.filter(({ occurredAt }) => occurredAt >= seasonStart))
  const enhancements = toEnhancementPage(records.enhancements)
  const acquisitions = toAcquisitionPage(records.acquisitions)

  return {
    weeklyClears,
    seasonClears,
    enhancements: enhancements.items,
    enhancementsCursor: enhancements.nextCursor,
    acquisitions: acquisitions.items,
    acquisitionsCursor: acquisitions.nextCursor
  }
}

function readPageRows(
  client: DatabaseClient,
  character: TimelineCharacter,
  list: TimelinePageList,
  before?: TimelineItemCursor
): Promise<TimelineItemRow[]> {
  return readRecentTimelineItems(client, character, {
    ...PAGE_QUERIES[list],
    limit: PAGE_SIZE + 1,
    before
  })
}

export async function readCharacterTimeline(
  client: DatabaseClient,
  character: TimelineCharacter,
  now: Date
): Promise<CharacterTimeline> {
  const weekStart = startOfResetWeek(now)
  const seasonStart = await readCurrentSeasonStart(client, now)
  if (seasonStart === undefined) {
    throw new Error('No season has started')
  }
  const since = new Date(Math.min(weekStart.getTime(), seasonStart.getTime()))
  const [clears, enhancements, acquisitions] = await Promise.all([
    readTimelineEvents(client, character, CLEAR_CODES, since),
    readPageRows(client, character, 'enhancements'),
    readPageRows(client, character, 'acquisitions')
  ])

  return toCharacterTimeline({ clears, enhancements, acquisitions }, weekStart, seasonStart)
}

export async function readTimelinePage(
  client: DatabaseClient,
  character: TimelineCharacter,
  list: TimelinePageList,
  before: TimelineItemCursor
): Promise<TimelineItemPage> {
  const rows = await readPageRows(client, character, list, before)
  if (list === 'enhancements') {
    return toEnhancementPage(rows)
  }

  return toAcquisitionPage(rows)
}
