import { z } from 'zod'

const count = z.number().int().nonnegative()
const nullableText = z.string().nullable()

export const clearContentKindSchema = z.enum(['raid', 'challenge'])

const clearContentHeader = {
  id: z.string(),
  kind: clearContentKindSchema,
  name: z.string(),
  releasedAt: z.iso.datetime(),
  latest: z.boolean()
}

export const clearWeekSchema = z.object({
  weekStart: z.iso.date(),
  closed: z.boolean(),
  collectedAt: z.iso.datetime(),
  population: count,
  minFame: z.number().int().nullable(),
  cleared: count,
  newlyCleared: count.nullable(),
  ratios: z.array(z.object({ ratio: z.number().int().nullable(), cleared: count }))
})

export const clearStatsSchema = z.object({
  contents: z.array(z.object({ ...clearContentHeader, weeks: z.array(clearWeekSchema) }))
})

export const clearContentStatsSchema = z.object({
  ...clearContentHeader,
  week: clearWeekSchema.nullable(),
  jobs: z.array(
    z.object({
      jobId: nullableText,
      jobGrowId: nullableText,
      jobName: nullableText,
      jobGrowName: nullableText,
      population: count,
      cleared: count
    })
  ),
  adventures: z.array(
    z.object({ characters: z.number().int().positive(), adventures: z.number().int().positive() })
  )
})

export type ClearContentKind = z.infer<typeof clearContentKindSchema>
export type ClearWeek = z.infer<typeof clearWeekSchema>
export type ClearStats = z.infer<typeof clearStatsSchema>
export type ClearContent = ClearStats['contents'][number]
export type ClearContentStats = z.infer<typeof clearContentStatsSchema>
export type ClearJob = ClearContentStats['jobs'][number]
export type ClearAdventureSize = ClearContentStats['adventures'][number]
