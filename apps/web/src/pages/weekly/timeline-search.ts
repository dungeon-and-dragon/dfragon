import { z } from 'zod'
import { ADVENTURE_TIMELINE_KINDS, type AdventureTimelineKind } from '#entities/adventure-guild'

export type TimelineSearch = { kind?: AdventureTimelineKind }

const searchSchema = z.object({
  kind: z.enum(ADVENTURE_TIMELINE_KINDS).optional().catch(undefined)
})

export function parseTimelineSearch(search: Record<string, unknown>): TimelineSearch {
  const { kind } = searchSchema.parse(search)

  return { kind }
}
