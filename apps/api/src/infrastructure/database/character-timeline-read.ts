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
  toTimelineClearData,
  toEnhancement,
  toEnhancementPage
} from '../../domain/character-timeline/project.js'
import { startOfResetWeek } from '../../domain/seoul-time.js'

const ACQUISITION_RARITIES = ['에픽', '태초']
const PAGE_QUERIES = {
  enhancements: { codes: ENHANCEMENT_CODES },
  acquisitions: { codes: ACQUISITION_CODES, itemRarities: ACQUISITION_RARITIES }
} satisfies Record<TimelinePageList, Pick<RecentTimelineItemQuery, 'codes' | 'itemRarities'>>

const enhancementData = z.object({
  before: z.number().nullable().catch(null),
  after: z.number(),
  result: z.boolean(),
  safe: z.boolean().nullable().catch(null)
})

function parseClear(row: TimelineEventRow): TimelineClearRecord {
  const data = toTimelineClearData(row.code, row.data)

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
