import type { LabItemGroup } from '@dfragon/database'
import {
  LAB_ITEM_CATEGORIES,
  LAB_ITEM_ROLES,
  LAB_ITEM_TIERS,
  labItemRolesOf
} from '@dfragon/lib/lab-items'
import { z } from 'zod'

const itemName = z.string().trim().min(1)

// lab_items.currency_count가 int4다.
const cost = z.object({
  currencyId: z.int().positive().max(Number.MAX_SAFE_INTEGER),
  count: z.int().positive().max(2_147_483_647)
})

const item = z.object({ itemName, cost: cost.nullable() })

export const replaceBody = z
  .object({
    category: z.enum(LAB_ITEM_CATEGORIES),
    role: z.enum(LAB_ITEM_ROLES),
    tier: z.enum(LAB_ITEM_TIERS),
    items: z.array(item)
  })
  .refine(({ category, role }) => labItemRolesOf(category).includes(role))
  .refine(({ items }) => new Set(items.map(({ itemName }) => itemName)).size === items.length)

export type ReplaceBody = z.infer<typeof replaceBody>

export type LabItemListResponse = {
  groups: LabItemGroup[]
}

export function toLabItemListResponse(groups: LabItemGroup[]): LabItemListResponse {
  return { groups }
}
