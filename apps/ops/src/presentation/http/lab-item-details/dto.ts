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

// tooltip 한 상자에 들어갈 만큼으로 둔다.
const TYPE_DETAIL_MAX_LENGTH = 40
const SLOT_MAX_COUNT = 12
const STAGE_MAX_COUNT = 5
const OPTION_MAX_COUNT = 30
const OPTION_TEXT_MAX_LENGTH = 40

const shortText = z.string().trim().min(1).max(OPTION_TEXT_MAX_LENGTH)

// 빈 값은 값이 없는 것으로 저장해 tooltip이 그 줄을 빼게 한다.
const typeDetailField = z
  .string()
  .trim()
  .max(TYPE_DETAIL_MAX_LENGTH)
  .transform((value) => {
    if (value === '') {
      return null
    }

    return value
  })

const stageField = z.object({
  upgrade: z.int().min(0),
  status: z.array(z.object({ name: shortText, value: shortText })).max(OPTION_MAX_COUNT)
})

// 공개 API가 카드 상세와 같은 모양으로 내므로, 단계는 upgrade가 커지는 순서로만 받는다.
const cardField = z.object({
  slots: z.array(shortText).min(1).max(SLOT_MAX_COUNT),
  enchants: z
    .array(stageField)
    .min(1)
    .max(STAGE_MAX_COUNT)
    .refine((stages) =>
      stages.every((stage, index) => index === 0 || stages[index - 1].upgrade < stage.upgrade)
    )
})

// icon을 빼면 저장한 아이콘을 그대로 두고, null이면 지운다.
export const saveBody = z.object({
  itemName,
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
