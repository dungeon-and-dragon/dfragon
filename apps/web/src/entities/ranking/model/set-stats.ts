import { z } from 'zod'

const count = z.number().int().nonnegative()

function sumOf(items: readonly Readonly<{ count: number }>[]): number {
  return items.reduce((sum, item) => sum + item.count, 0)
}

const oathSetSchema = z
  .object({
    setId: z.number().int().nullable(),
    name: z.string().nullable(),
    count,
    options: z.array(z.object({ name: z.string().nullable(), count }))
  })
  .refine(({ count: setCount, options }) => sumOf(options) === setCount)

export const setStatsSchema = z
  .object({
    computedAt: z.iso.datetime().nullable(),
    sampleSize: count,
    equipmentSets: z.array(
      z.object({ setId: z.string().nullable(), name: z.string().nullable(), count })
    ),
    oathSets: z.array(oathSetSchema),
    combos: z.array(
      z.object({
        equipmentSetId: z.string().nullable(),
        oathSetId: z.number().int().nullable(),
        count
      })
    )
  })
  .refine(({ sampleSize, equipmentSets, oathSets, combos }) =>
    [equipmentSets, oathSets, combos].every((items) => sumOf(items) === sampleSize)
  )

export type SetStats = z.infer<typeof setStatsSchema>
export type EquipmentSetCount = SetStats['equipmentSets'][number]
export type OathSetCount = SetStats['oathSets'][number]
export type SetComboCount = SetStats['combos'][number]
