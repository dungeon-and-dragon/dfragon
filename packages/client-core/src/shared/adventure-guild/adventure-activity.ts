import { z } from 'zod'

const count = z.number().int().nonnegative()
const nameCount = z.object({ name: z.string(), count })
const enhancementTarget = z.object({ target: z.number().int(), attempts: count, successes: count })

export const adventureActivitySchema = z.object({
  seasons: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      startsAt: z.iso.datetime(),
      available: z.boolean()
    })
  ),
  season: z
    .object({
      id: z.number().int(),
      startsAt: z.iso.datetime(),
      endsAt: z.iso.datetime().nullable()
    })
    .nullable(),
  summary: z.object({
    raids: z.array(nameCount),
    legions: z.array(nameCount),
    items: z.object({ legendary: count, epic: count, primeval: count, mythic: count }),
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
      highEnhancement: z.boolean()
    })
  )
})

export type AdventureActivity = z.infer<typeof adventureActivitySchema>
export type ActivitySeason = AdventureActivity['seasons'][number]
export type ActivitySummary = AdventureActivity['summary']
export type EnhancementTarget = ActivitySummary['enhancement']['amplify'][number]
