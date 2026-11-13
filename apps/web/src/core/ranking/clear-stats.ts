import { z } from 'zod'

const count = z.number().int().nonnegative()
const nullableText = z.string().nullable()

export const clearContentKindSchema = z.enum(['raid', 'challenge', 'legion'])

const clearContentHeader = {
  id: z.string(),
  kind: clearContentKindSchema,
  name: z.string(),
  releasedAt: z.iso.datetime(),
  entryFame: count.nullable(),
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

const clearContentSummarySchema = z.object({
  ...clearContentHeader,
  weeks: z.array(clearWeekSchema)
})

export const clearStatsSchema = z.object({
  contents: z.array(clearContentSummarySchema),
  legions: z.array(clearContentSummarySchema)
})

const fameDistributionSchema = z.object({
  p5: z.number(),
  p25: z.number(),
  median: z.number(),
  p75: z.number(),
  p95: z.number(),
  max: z.number()
})

const scoreDistributionsSchema = z.object({
  equipment: fameDistributionSchema.nullable(),
  buff: fameDistributionSchema.nullable()
})

const clearJobSchema = z.object({
  jobId: nullableText,
  jobGrowId: nullableText,
  jobName: nullableText,
  jobGrowName: nullableText,
  population: count,
  cleared: count,
  fame: fameDistributionSchema.nullable(),
  scores: scoreDistributionsSchema
})

const clearTimesSchema = {
  weekdays: z.array(z.object({ weekday: z.number().int().min(1).max(7), cleared: count })),
  hours: z.array(z.object({ hour: z.number().int().min(0).max(23), cleared: count }))
}

const weekGroupSchema = z.object({
  cleared: count,
  fame: fameDistributionSchema.nullable(),
  scores: scoreDistributionsSchema
})

const scoreBandSchema = z.object({ score: count, population: count, cleared: count })

const stageCountsSchema = z.object({ same: count, other: count, none: count })

export const clearContentStatsSchema = z.object({
  ...clearContentHeader,
  ...clearTimesSchema,
  week: clearWeekSchema.nullable(),
  jobs: z.array(clearJobSchema),
  adventures: z.array(
    z.object({ characters: z.number().int().positive(), adventures: z.number().int().positive() })
  ),
  weeklyClears: z.array(
    z.object({
      weekStart: z.iso.date(),
      population: count,
      firstCleared: count,
      repeatCleared: count,
      everCleared: count
    })
  ),
  fameBands: z.array(z.object({ fame: count, population: count, cleared: count })),
  weekOverWeek: z
    .object({
      both: weekGroupSchema,
      returned: weekGroupSchema,
      left: weekGroupSchema,
      first: weekGroupSchema
    })
    .nullable(),
  stageMoves: z.object({ hard: stageCountsSchema, normal: stageCountsSchema }).nullable(),
  streaks: z.array(z.object({ weeks: z.number().int().positive(), characters: count })).nullable(),
  stages: z.array(z.object({ stage: z.string(), characters: count })).nullable(),
  scoreBands: z.object({ equipment: z.array(scoreBandSchema), buff: z.array(scoreBandSchema) })
})

export const clearOverviewSchema = z.object({
  weekStart: z.iso.date().nullable(),
  contents: z.array(
    z.object({
      id: z.string(),
      cleared: count,
      fame: fameDistributionSchema.nullable(),
      scores: scoreDistributionsSchema,
      jobs: z.array(clearJobSchema),
      coClears: z.array(z.object({ id: z.string(), cleared: count }))
    })
  ),
  ...clearTimesSchema
})

export type ClearContentKind = z.infer<typeof clearContentKindSchema>
export type ClearWeek = z.infer<typeof clearWeekSchema>
export type ClearStats = z.infer<typeof clearStatsSchema>
export type ClearContent = ClearStats['contents'][number]
export type ClearContentStats = z.infer<typeof clearContentStatsSchema>
export type ClearJob = ClearContentStats['jobs'][number]
export type ClearAdventureSize = ClearContentStats['adventures'][number]
export type ClearWeekOverWeek = NonNullable<ClearContentStats['weekOverWeek']>
export type ClearStageMoves = NonNullable<ClearContentStats['stageMoves']>
export type ClearTimes = Pick<ClearContentStats, 'weekdays' | 'hours'>
export type ClearScoreDistributions = z.infer<typeof scoreDistributionsSchema>
export type ClearScoreKind = keyof ClearScoreDistributions
export type ClearScoreBand = z.infer<typeof scoreBandSchema>
export type ClearFameDistribution = z.infer<typeof fameDistributionSchema>
export type ClearOverview = z.infer<typeof clearOverviewSchema>
export type ClearOverviewContent = ClearOverview['contents'][number]
export type ClearOverviewJob = ClearOverviewContent['jobs'][number]
