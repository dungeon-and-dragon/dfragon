import { z } from 'zod'

const REWARD_TAGS = [
  'enchant',
  'reinforce',
  'equipment',
  'oath',
  'upgrade',
  'emblem',
  'artifact',
  'creature',
  'title',
  'aura',
  'avatar',
  'material',
  'entry',
  'currency',
  'other'
] as const

const ITEM_ID_PATTERN = /^[0-9a-f]{32}$/
const SOURCE_HASH_PATTERN = /^[0-9a-f]{16}$/

const dateSchema = z.iso.date()
const countSchema = z.number().int().positive()

const contentItemSchema = z.strictObject({
  name: z.string().min(1),
  itemId: z.string().regex(ITEM_ID_PATTERN).nullable(),
  quantity: countSchema,
  tags: z.array(z.enum(REWARD_TAGS))
})

const itemSchema = contentItemSchema.extend({
  binding: z.enum(['account', 'character', 'tradable']).nullable(),
  expiresAt: dateSchema.nullable(),
  contents: z.array(
    z.strictObject({ mode: z.enum(['all', 'chooseOne']), items: z.array(contentItemSchema).min(1) })
  )
})

const limitSchema = z.strictObject({
  count: countSchema,
  scope: z.enum(['account', 'character']),
  per: z.enum(['event', 'month', 'week', 'day'])
})

const acquisitionSchema = z.strictObject({
  via: z.enum(['mission', 'milestone', 'shop', 'package', 'pass']),
  gives: itemSchema,
  costs: z.array(z.strictObject({ name: z.string().min(1), amount: countSchema })),
  condition: z.string().min(1).nullable(),
  limit: limitSchema.nullable(),
  evidence: z.enum(['table', 'image'])
})

const eventSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  url: z.url(),
  period: z.strictObject({ start: dateSchema, end: dateSchema.nullable() }),
  sourceHash: z.string().regex(SOURCE_HASH_PATTERN),
  acquisitions: z.array(acquisitionSchema)
})

export const eventRewardsSchema = z.strictObject({
  version: z.literal(1),
  readAt: dateSchema,
  events: z.array(eventSchema)
})

export type EventRewards = z.infer<typeof eventRewardsSchema>
