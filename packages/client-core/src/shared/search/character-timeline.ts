import { z } from 'zod'

const nullableText = z.string().nullable()
const occurredAt = z.iso.datetime()
const clearKind = z.enum(['raid', 'legion'])

export const characterTimelineSchema = z.object({
  weeklyClears: z.array(
    z.object({ kind: clearKind, name: z.string(), modeName: nullableText, occurredAt })
  ),
  seasonClears: z.array(
    z.object({ kind: clearKind, name: z.string(), count: z.number().int().positive() })
  ),
  enhancements: z.array(
    z.object({
      kind: z.enum(['reinforce', 'amplify', 'refine']),
      itemId: nullableText,
      itemName: nullableText,
      itemRarity: nullableText,
      before: z.number().int().nullable(),
      after: z.number().int(),
      result: z.boolean(),
      safe: z.boolean().nullable(),
      occurredAt
    })
  ),
  acquisitions: z.array(
    z.object({
      code: z.number().int(),
      name: z.string(),
      itemId: nullableText,
      itemName: nullableText,
      itemRarity: z.enum(['에픽', '태초']),
      occurredAt
    })
  )
})

export type CharacterTimeline = z.infer<typeof characterTimelineSchema>
export type TimelineClear = CharacterTimeline['weeklyClears'][number]
export type TimelineClearCount = CharacterTimeline['seasonClears'][number]
export type TimelineEnhancement = CharacterTimeline['enhancements'][number]
export type TimelineAcquisition = CharacterTimeline['acquisitions'][number]
