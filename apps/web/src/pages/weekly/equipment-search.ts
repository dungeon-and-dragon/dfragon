import { z } from 'zod'

export type EquipmentSearch = { server?: string; set?: string }

const searchSchema = z.object({
  server: z.string().optional().catch(undefined),
  set: z.string().optional().catch(undefined)
})

export function parseEquipmentSearch(search: Record<string, unknown>): EquipmentSearch {
  const { server, set } = searchSchema.parse(search)

  return { server, set }
}
