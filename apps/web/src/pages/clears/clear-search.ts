import { z } from 'zod'

export type ClearSearch = { content?: string; week?: string }

export type ClearWeekSearch = { week?: string }

const weekSchema = z.iso.date().optional().catch(undefined)

const searchSchema = z.object({
  content: z.string().optional().catch(undefined),
  week: weekSchema
})

const weekSearchSchema = z.object({ week: weekSchema })

export function parseClearSearch(search: Record<string, unknown>): ClearSearch {
  const { content, week } = searchSchema.parse(search)

  return { content, week }
}

export function parseClearWeekSearch(search: Record<string, unknown>): ClearWeekSearch {
  const { week } = weekSearchSchema.parse(search)

  return { week }
}
