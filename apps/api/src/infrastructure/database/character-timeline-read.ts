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
import {
  ACQUISITION_CODES,
  CLEAR_CODES,
  ENHANCEMENT_CODES,
  LEGION_CLEAR_CODE,
  TIMELINE_PAGE_SIZE,
  type CharacterTimeline,
  type TimelineClear,
  type TimelineClearRecord,
  type TimelineEnhancement,
  type TimelineEnhancementRecord,
  type TimelineItemPage,
  type TimelinePageList,
  toAcquisitionPage,
  toCharacterTimeline,
  toClear,
  toEnhancement,
  toEnhancementPage
} from '../../domain/character-timeline/project.js'
import { startOfResetWeek } from '../../utils/seoul-time.js'

const ACQUISITION_RARITIES = ['에픽', '태초']
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

function parseClear(row: TimelineEventRow): TimelineClearRecord {
  const parsed =
    row.code === LEGION_CLEAR_CODE
      ? legionClearData.safeParse(row.data)
      : raidClearData.safeParse(row.data)
  const data = parsed.success ? parsed.data : null

  return { ...row, data }
}

function parseEnhancement(row: TimelineItemRow): TimelineEnhancementRecord {
  const parsed = enhancementData.safeParse(row.data)
  const data = parsed.success ? parsed.data : null

  return { ...row, data }
}

export function parseTimelineClearRow(row: TimelineEventRow): TimelineClear[] {
  return toClear(parseClear(row))
}

export function parseTimelineEnhancementRow(row: TimelineItemRow): TimelineEnhancement[] {
  return toEnhancement(parseEnhancement(row))
}

export function parseCharacterTimelineRows(
  records: {
    clears: readonly TimelineEventRow[]
    enhancements: readonly TimelineItemRow[]
    acquisitions: readonly TimelineItemRow[]
  },
  weekStart: Date,
  seasonStart: Date
): CharacterTimeline {
  return toCharacterTimeline(
    {
      clears: records.clears.map(parseClear),
      enhancements: records.enhancements.map(parseEnhancement),
      acquisitions: records.acquisitions
    },
    weekStart,
    seasonStart
  )
}

function readPageRows(
  client: DatabaseClient,
  character: TimelineCharacter,
  list: TimelinePageList,
  before?: TimelineItemCursor
): Promise<TimelineItemRow[]> {
  return readRecentTimelineItems(client, character, {
    ...PAGE_QUERIES[list],
    limit: TIMELINE_PAGE_SIZE + 1,
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

  return parseCharacterTimelineRows({ clears, enhancements, acquisitions }, weekStart, seasonStart)
}

export async function readTimelinePage(
  client: DatabaseClient,
  character: TimelineCharacter,
  list: TimelinePageList,
  before: TimelineItemCursor
): Promise<TimelineItemPage> {
  const rows = await readPageRows(client, character, list, before)
  if (list === 'enhancements') {
    return toEnhancementPage(rows.map(parseEnhancement))
  }

  return toAcquisitionPage(rows)
}
