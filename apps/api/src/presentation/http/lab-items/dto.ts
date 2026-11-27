import type { LabEnchantCard, LabEnchantOptions, LabItems } from '#application/lab-items/index.js'

export type LabItemsResponse = LabItems

type LabEnchantSlotResponse = LabEnchantOptionsResponse['slots'][number]
type LabEnchantTierResponse = LabEnchantSlotResponse['tiers'][number]
type LabEnchantOptionResponse = LabEnchantTierResponse['options'][number]

export interface LabEnchantOptionsResponse {
  slots: {
    slotId: string
    role: string
    tiers: {
      tier: string
      options: {
        id: string
        display: readonly { name: string; value: number | string }[]
        skillLevel: number | null
        cards: readonly LabEnchantCard[]
      }[]
    }[]
  }[]
}

type LabEnchantSlot = LabEnchantOptions['slots'][number]
type LabEnchantTier = LabEnchantSlot['tiers'][number]

// 계산에만 쓰는 항목별 옵션(members)은 응답에 싣지 않는다.
function toOptionResponse({
  id,
  display,
  skillLevel,
  cards
}: LabEnchantTier['options'][number]): LabEnchantOptionResponse {
  return { id, display, skillLevel, cards }
}

function toTierResponse({ tier, options }: LabEnchantTier): LabEnchantTierResponse {
  const optionResponses = options.map(toOptionResponse)

  return { tier, options: optionResponses }
}

function toSlotResponse({ slotId, role, tiers }: LabEnchantSlot): LabEnchantSlotResponse {
  const tierResponses = tiers.map(toTierResponse)

  return { slotId, role, tiers: tierResponses }
}

export function toEnchantOptionsResponse({ slots }: LabEnchantOptions): LabEnchantOptionsResponse {
  const slotResponses = slots.map(toSlotResponse)

  return { slots: slotResponses }
}

const CURRENCY_ID_DIGITS = /^[1-9]\d{0,14}$/

export function readCurrencyId(value: string): number | null {
  if (!CURRENCY_ID_DIGITS.test(value)) {
    return null
  }

  return Number(value)
}
