import { z } from 'zod'

export const epicSoulsSchema = z.object({
  total: z.number().int().nonnegative(),
  slots: z.array(
    z.object({
      slotId: z.string(),
      itemId: z.string(),
      itemName: z.string(),
      itemRarity: z.string(),
      tune: z.number().int(),
      souls: z.number().int().nonnegative()
    })
  )
})

export type EpicSouls = z.infer<typeof epicSoulsSchema>

export type EpicSoulSlot = EpicSouls['slots'][number]
