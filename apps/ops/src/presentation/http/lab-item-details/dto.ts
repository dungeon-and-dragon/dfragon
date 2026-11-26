import type { LabItemDetailSummary } from '@dfragon/database'
import { LAB_ITEM_RARITIES } from '@dfragon/lib/lab-items'
import { z } from 'zod'
import { OpsFailure } from '#domain/failure.js'
import { descriptionField, iconField } from '#presentation/http/lab-fields.js'

const itemName = z.string().trim().min(1)

export function readItemName(value: string | undefined): string {
  const name = itemName.safeParse(value)

  if (!name.success) {
    throw new OpsFailure('request')
  }

  return name.data
}

// icon을 빼면 저장한 아이콘을 그대로 두고, null이면 지운다.
export const saveBody = z.object({
  itemName,
  description: descriptionField,
  itemRarity: z.enum(LAB_ITEM_RARITIES).nullable(),
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
