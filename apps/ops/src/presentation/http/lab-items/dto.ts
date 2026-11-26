import type { LabItemGroup } from '@dfragon/database'
import {
  LAB_ITEM_CATEGORIES,
  LAB_ITEM_ROLES,
  LAB_ITEM_TIERS,
  labItemRolesOf
} from '@dfragon/lib/lab-items'
import { z } from 'zod'

const itemName = z.string().trim().min(1)

export const replaceBody = z
  .object({
    category: z.enum(LAB_ITEM_CATEGORIES),
    role: z.enum(LAB_ITEM_ROLES),
    tier: z.enum(LAB_ITEM_TIERS),
    itemNames: z.array(itemName)
  })
  .refine(({ category, role }) => labItemRolesOf(category).includes(role))
  .refine(({ itemNames }) => new Set(itemNames).size === itemNames.length)

export type ReplaceBody = z.infer<typeof replaceBody>

export type LabItemListResponse = {
  groups: LabItemGroup[]
}

export function toLabItemListResponse(groups: LabItemGroup[]): LabItemListResponse {
  return { groups }
}
