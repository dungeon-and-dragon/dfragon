import { z } from 'zod'

export type ClearSearch = { content?: string; week?: string }

const searchSchema = z.object({
  content: z.string().optional().catch(undefined),
  week: z.iso.date().optional().catch(undefined)
})

export function parseClearSearch(search: Record<string, unknown>): ClearSearch {
  const { content, week } = searchSchema.parse(search)

  return { content, week }
}
