import { z } from 'zod'

export const itemDetailSchema = z.object({
  itemId: z.string().min(1),
  name: z.string(),
  rarity: z.string().nullable(),
  itemType: z.string().nullable(),
  typeDetail: z.string().nullable(),
  availableLevel: z.number().int().nullable(),
  fame: z.number().int().nullable(),
  status: z.array(z.object({ name: z.string(), value: z.string() })),
  explain: z.string().nullable(),
  flavorText: z.string().nullable()
})

export type ItemDetail = z.infer<typeof itemDetailSchema>
