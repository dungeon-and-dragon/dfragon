import { z } from 'zod'
import {
  clearKind,
  timelineAcquisitionSchema,
  timelineEnhancementSchema
} from '#entities/character/@x/adventure-guild'

export const ADVENTURE_TIMELINE_KINDS = ['enhancement', 'acquisition', 'clear'] as const

export type AdventureTimelineKind = (typeof ADVENTURE_TIMELINE_KINDS)[number]

const characterShape = {
  serverId: z.string(),
  characterId: z.string(),
  characterName: z.string()
}

const adventureTimelineItemSchema = z.discriminatedUnion('type', [
  timelineEnhancementSchema.extend({ type: z.literal('enhancement'), ...characterShape }),
  timelineAcquisitionSchema.extend({ type: z.literal('acquisition'), ...characterShape }),
  z.object({
    type: z.literal('clear'),
    ...characterShape,
    kind: clearKind,
    name: z.string(),
    modeName: z.string().nullable(),
    hard: z.boolean(),
    occurredAt: z.iso.datetime()
  })
])

export const adventureTimelinePageSchema = z.object({
  items: z.array(adventureTimelineItemSchema),
  nextCursor: z.string().nullable()
})

export type AdventureTimelineItem = z.infer<typeof adventureTimelineItemSchema>
export type AdventureTimelinePage = z.infer<typeof adventureTimelinePageSchema>
