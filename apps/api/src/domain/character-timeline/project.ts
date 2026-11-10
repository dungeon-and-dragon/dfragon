import type { TimelineItemCursor, TimelineItemRow } from '@dfragon/database'

export type TimelineClearRecord = {
  code: number
  occurredAt: Date
  raidName: string | null
  data: { regionName: string } | { modeName: string | null; hard: boolean } | null
}

export type TimelineEnhancementRecord = {
  id: bigint
  code: number
  occurredAt: Date
  itemId: string | null
  itemName: string | null
  itemRarity: string | null
  data: { before: number | null; after: number; result: boolean; safe: boolean | null } | null
}

export const RAID_CLEAR_CODES = [201, 210]
export const LEGION_CLEAR_CODE = 209
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
export const TIMELINE_PAGE_SIZE = 50
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
  clears: readonly TimelineClearRecord[]
  enhancements: readonly TimelineEnhancementRecord[]
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

export function toClear({
  code,
  occurredAt,
  raidName,
  data
}: TimelineClearRecord): TimelineClear[] {
  if (data === null) {
    return []
  }

  if (code === LEGION_CLEAR_CODE) {
    if (!('regionName' in data)) {
      return []
    }

    return [{ kind: 'legion', name: data.regionName, modeName: null, hard: false, occurredAt }]
  }

  if (raidName === null || !('modeName' in data)) {
    return []
  }

  const { modeName, hard } = data

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

export function toEnhancement(row: TimelineEnhancementRecord): TimelineEnhancement[] {
  const kind = ENHANCEMENT_KINDS.get(row.code)
  const enhancement = row.data
  if (kind === undefined || enhancement === null) {
    return []
  }
  const { before, after, result, safe } = enhancement

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
function toPage<Row extends TimelineItemCursor, Item>(
  rows: readonly Row[],
  toItems: (rows: readonly Row[]) => Item[]
): TimelinePage<Item> {
  const page = rows.slice(0, TIMELINE_PAGE_SIZE)
  const last = page.at(-1)
  const items = toItems(page)
  const nextCursor =
    rows.length > TIMELINE_PAGE_SIZE && last !== undefined ? formatTimelineCursor(last) : null

  return { items, nextCursor }
}

export function toEnhancementPage(
  rows: readonly TimelineEnhancementRecord[]
): TimelinePage<TimelineEnhancement> {
  return toPage(rows, (page) => page.flatMap(toEnhancement))
}

export function toAcquisitionPage(
  rows: readonly TimelineItemRow[]
): TimelinePage<TimelineAcquisition> {
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
