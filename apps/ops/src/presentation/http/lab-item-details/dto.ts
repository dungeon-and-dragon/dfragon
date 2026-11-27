import type { LabItemDetailSummary } from '@dfragon/database'
import { LAB_ITEM_RARITIES } from '@dfragon/lib/lab-items'
import { z } from 'zod'
import {
  cardField,
  descriptionField,
  iconField,
  itemNameField,
  typeDetailField
} from '#presentation/http/lab-fields.js'

// icon을 빼면 저장한 아이콘을 그대로 두고, null이면 지운다.
export const saveBody = z.object({
  itemName: itemNameField,
  description: descriptionField,
  itemRarity: z.enum(LAB_ITEM_RARITIES).nullable(),
  itemTypeDetail: typeDetailField,
  availableLevel: z.int32().positive().nullable(),
  fame: z.int32().positive().nullable(),
  card: cardField.nullable(),
  icon: iconField.nullable().optional()
})

export type LabItemDetailListResponse = {
  details: LabItemDetailSummary[]
}

export function toLabItemDetailListResponse(
  details: LabItemDetailSummary[]
): LabItemDetailListResponse {
  return { details }
}
