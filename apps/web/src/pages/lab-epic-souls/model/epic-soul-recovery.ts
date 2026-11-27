import { z } from 'zod'

const itemSchema = z.object({ itemId: z.string(), itemName: z.string(), itemRarity: z.string() })

export const recoverySchema = z.object({
  souls: z.object({
    total: z.number().int().nonnegative(),
    slots: z.array(
      z.object({
        slotId: z.string(),
        before: itemSchema.extend({
          tune: z.number().int(),
          reinforce: z.number().int(),
          amplified: z.boolean()
        }),
        after: itemSchema.extend({ line: z.string().optional() }).nullable(),
        souls: z.number().int().nonnegative()
      })
    )
  }),
  best: z.object({ setItemId: z.string(), weaponVariantId: z.string().nullable() }).nullable()
})

export type EpicSoulRecovery = z.infer<typeof recoverySchema>

export type EpicSoulRecoverySlot = EpicSoulRecovery['souls']['slots'][number]
