import type { TimelineEventRow, TimelineItemRow } from '@dfragon/database'
import { z } from 'zod'
import {
  type TimelineClear,
  type TimelineClearRecord,
  type TimelineEnhancement,
  type TimelineEnhancementRecord,
  toClear,
  toTimelineClearData,
  toEnhancement
} from '@dfragon/server-core/domain/character-timeline/index.js'

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
