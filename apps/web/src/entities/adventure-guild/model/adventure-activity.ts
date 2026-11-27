import { z } from 'zod'

const count = z.number().int().nonnegative()
const nameCount = z.object({ name: z.string(), count })
// 하드, 노말과 레이드 이름, 단계를 보내기 전의 API와도 호환하도록 없으면 받지 않는다.
const raidCount = nameCount.extend({
  raid: z.string().optional(),
  stage: z.string().nullable().optional(),
  hard: count.optional(),
  normal: count.optional()
})
// 처음 본 클리어 시각을 보내기 전의 API와도 호환하도록 없으면 받지 않는다.
const released = { releasedAt: z.iso.datetime().nullable().optional() }
const enhancementTarget = z.object({ target: z.number().int(), attempts: count, successes: count })

export const adventureActivitySchema = z.object({
  seasons: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      startsAt: z.iso.datetime(),
      available: z.boolean(),
      backfill: z.object({ done: count, total: count, running: z.boolean() }).optional()
    })
  ),
  season: z
    .object({
      id: z.number().int(),
      startsAt: z.iso.datetime(),
      endsAt: z.iso.datetime().nullable(),
      timelineStartsAt: z.iso.datetime()
    })
    .nullable(),
  summary: z.object({
    raids: z.array(raidCount.extend(released)),
    legions: z.array(nameCount.extend(released)),
    items: z.object({ legendary: count, epic: count, primeval: count, mythic: count }),
    oaths: z.object({ legendary: count, epic: count, primeval: count }),
    enhancement: z.object({
      attempts: count,
      amplify: z.array(enhancementTarget),
      reinforce: z.array(enhancementTarget),
      amplifyBelow10: count,
      reinforceBelow12: count,
      refine: count
    })
  }),
  days: z.array(
    z.object({
      date: z.iso.date(),
      raid: count,
      legion: count,
      item: count,
      enhance: count,
      primeval: z.boolean(),
      mythic: z.boolean(),
      highEnhancement: z.boolean(),
      oath: count,
      oathPrimeval: z.boolean()
    })
  )
})

export type AdventureActivity = z.infer<typeof adventureActivitySchema>
export const activitySeasonSchema = adventureActivitySchema.shape.seasons.element
export type ActivitySeason = z.infer<typeof activitySeasonSchema>
export type SeasonBackfill = NonNullable<ActivitySeason['backfill']>
export type ActivitySummary = AdventureActivity['summary']
export type EnhancementTarget = ActivitySummary['enhancement']['amplify'][number]

const dayItem = z.object({
  at: z.iso.datetime({ offset: true }),
  name: z.string(),
  rarity: z.string()
})

const adventureActivityDaySchema = z.object({
  date: z.iso.date(),
  raids: z.array(raidCount),
  legions: z.array(nameCount),
  items: z.array(dayItem),
  oaths: z.array(dayItem),
  enhancements: z.array(
    z.object({
      at: z.iso.datetime({ offset: true }),
      kind: z.enum(['reinforce', 'amplify', 'refine']),
      target: z.number().int(),
      success: z.boolean()
    })
  )
})

export type AdventureActivityDay = z.infer<typeof adventureActivityDaySchema>

export const adventureActivitySeasonDaysSchema = z.object({
  season: z.number().int(),
  days: z.array(adventureActivityDaySchema)
})

export type AdventureActivitySeasonDays = z.infer<typeof adventureActivitySeasonDaysSchema>
export type ActivityDayItem = AdventureActivityDay['items'][number]
export type ActivityDayEnhancement = AdventureActivityDay['enhancements'][number]
