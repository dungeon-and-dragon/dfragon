import { z } from 'zod'

const nullableText = z.string().nullable()
const occurredAt = z.iso.datetime()
export const clearKind = z.enum(['raid', 'legion'])

export const timelineEnhancementSchema = z.object({
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

export const timelineAcquisitionSchema = z.object({
  code: z.number().int(),
  name: z.string(),
  itemId: nullableText,
  itemName: nullableText,
  itemRarity: z.enum(['에픽', '태초']),
  occurredAt
})

export type TimelineEnhancement = z.infer<typeof timelineEnhancementSchema>
