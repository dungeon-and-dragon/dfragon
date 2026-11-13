import { z } from 'zod'

const count = z.number().int().nonnegative()
const nullableText = z.string().nullable()

export const clearContentKindSchema = z.enum(['raid', 'challenge'])

const clearContentHeader = {
  id: z.string(),
  kind: clearContentKindSchema,
  name: z.string(),
  releasedAt: z.iso.datetime(),
  entryFame: count,
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

const fameDistributionSchema = z.object({
  p5: z.number(),
  p25: z.number(),
  median: z.number(),
  p75: z.number(),
  p95: z.number(),
  max: z.number()
})

export const clearOverviewSchema = z.object({
  weekStart: z.iso.date().nullable(),
  contents: z.array(
    z.object({
      id: z.string(),
      cleared: count,
      fame: fameDistributionSchema.nullable(),
      jobs: z.array(
        z.object({
          jobId: nullableText,
          jobGrowId: nullableText,
          jobName: nullableText,
          jobGrowName: nullableText,
          population: count,
          cleared: count,
          fame: fameDistributionSchema.nullable()
        })
      ),
      coClears: z.array(z.object({ id: z.string(), cleared: count }))
    })
  ),
  weekdays: z.array(z.object({ weekday: z.number().int().min(1).max(7), cleared: count })),
  hours: z.array(z.object({ hour: z.number().int().min(0).max(23), cleared: count }))
})

export type ClearContentKind = z.infer<typeof clearContentKindSchema>
export type ClearWeek = z.infer<typeof clearWeekSchema>
export type ClearStats = z.infer<typeof clearStatsSchema>
export type ClearContent = ClearStats['contents'][number]
export type ClearContentStats = z.infer<typeof clearContentStatsSchema>
export type ClearJob = ClearContentStats['jobs'][number]
export type ClearAdventureSize = ClearContentStats['adventures'][number]
export type ClearFameDistribution = z.infer<typeof fameDistributionSchema>
export type ClearOverview = z.infer<typeof clearOverviewSchema>
export type ClearOverviewContent = ClearOverview['contents'][number]
export type ClearOverviewJob = ClearOverviewContent['jobs'][number]
