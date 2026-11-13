import { z } from 'zod'

export type ClearSearch = { content?: string; week?: string }

export type ClearDetailSearch = { stage?: string; week?: string }

const weekSchema = z.iso.date().optional().catch(undefined)

const searchSchema = z.object({
  content: z.string().optional().catch(undefined),
  week: weekSchema
})

const detailSearchSchema = z.object({
  stage: z.string().optional().catch(undefined),
  week: weekSchema
})

export function parseClearSearch(search: Record<string, unknown>): ClearSearch {
  const { content, week } = searchSchema.parse(search)

  return { content, week }
}

export function parseClearDetailSearch(search: Record<string, unknown>): ClearDetailSearch {
  const { stage, week } = detailSearchSchema.parse(search)

  return { stage, week }
}
