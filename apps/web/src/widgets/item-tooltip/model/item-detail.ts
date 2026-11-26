import { z } from 'zod'

const statusSchema = z.object({ name: z.string(), value: z.string() })

const cardSchema = z.object({
  slots: z.array(z.string()),
  enchants: z.array(z.object({ upgrade: z.number().int(), status: z.array(statusSchema) }))
})

export const itemDetailSchema = z.object({
  itemId: z.string().min(1),
  name: z.string(),
  rarity: z.string().nullable(),
  itemType: z.string().nullable(),
  typeDetail: z.string().nullable(),
  availableLevel: z.number().int().nullable(),
  fame: z.number().int().nullable(),
  status: z.array(statusSchema),
  explain: z.string().nullable(),
  flavorText: z.string().nullable(),
  card: cardSchema.nullable()
})

export type ItemDetail = z.infer<typeof itemDetailSchema>
export type ItemCard = NonNullable<ItemDetail['card']>
