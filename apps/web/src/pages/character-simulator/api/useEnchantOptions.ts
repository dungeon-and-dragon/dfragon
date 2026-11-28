import { ENCHANT_GRADE_SLOTS } from '@dfragon/lib/enchant-grades'
import { LAB_ITEM_TIERS, SLOT_ITEM_CATEGORIES } from '@dfragon/lib/lab-items'
import { z } from 'zod'
import { createJsonRequest } from '#shared/api/json-request'
import { API_BASE_URL, BROWSER_API_PATH, dfragonHttp } from '#shared/api/dfragon-api'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'

export const ENCHANT_OPTIONS_PATH = '/lab/enchant-options'

// API는 자기 origin 기준 경로를 주므로, 브라우저가 여는 같은 origin의 API 경로를 붙인다.
function browserApiUrl(path: string | null): string | null {
  if (path === null) {
    return null
  }

  return `${BROWSER_API_PATH}${path}`
}

const currencyCostSchema = z
  .object({
    currencyName: z.string(),
    description: z.string().nullable(),
    count: z.number().int().positive(),
    iconPath: z.string()
  })
  .transform(({ currencyName, count, iconPath }) => {
    const iconUrl = `${BROWSER_API_PATH}${iconPath}`

    return { currencyName, count, iconUrl }
  })

const cardSchema = z
  .object({
    itemName: z.string(),
    itemId: z.string().nullable(),
    itemRarity: z.string().nullable(),
    iconPath: z.string().nullable(),
    unitPrice: z.number().int().positive().nullable(),
    cost: currencyCostSchema.nullable()
  })
  .transform(({ iconPath, ...card }) => {
    const iconUrl = browserApiUrl(iconPath)

    return { ...card, iconUrl }
  })

const slotItemCardSchema = z
  .object({
    itemName: z.string(),
    gameItemName: z.string(),
    itemId: z.string().nullable(),
    itemRarity: z.string().nullable(),
    iconPath: z.string().nullable(),
    unitPrice: z.number().int().positive().nullable(),
    cost: currencyCostSchema.nullable()
  })
  .transform(({ iconPath, ...card }) => {
    const iconUrl = browserApiUrl(iconPath)

    return { ...card, iconUrl }
  })

export const enchantOptionsSchema = z.object({
  slots: z.array(
    z.object({
      slotId: z.enum(ENCHANT_GRADE_SLOTS),
      role: z.enum(['dealer', 'buffer']),
      tiers: z.array(
        z.object({
          tier: z.enum(LAB_ITEM_TIERS),
          options: z.array(
            z.object({
              id: z.string(),
              display: z.array(
                z.object({ name: z.string(), value: z.union([z.number(), z.string()]) })
              ),
              skillLevel: z.number().int().positive().nullable(),
              cards: z.array(cardSchema).min(1)
            })
          )
        })
      )
    })
  ),
  slotItems: z.array(
    z.object({
      category: z.enum(SLOT_ITEM_CATEGORIES),
      tiers: z.array(
        z.object({
          tier: z.enum(LAB_ITEM_TIERS),
          options: z.array(z.object({ id: z.string(), cards: z.array(slotItemCardSchema).min(1) }))
        })
      )
    })
  )
})

export type EnchantOptionsResponse = z.input<typeof enchantOptionsSchema>
export type EnchantOptions = z.output<typeof enchantOptionsSchema>
export type LabEnchantOption = EnchantOptions['slots'][number]['tiers'][number]['options'][number]
export type LabEnchantCard = LabEnchantOption['cards'][number]
export type LabSlotItemOption =
  EnchantOptions['slotItems'][number]['tiers'][number]['options'][number]
export type LabSlotItemCard = LabSlotItemOption['cards'][number]

const requestJson = createJsonRequest(dfragonHttp, API_BASE_URL)

function requestEnchantOptions(): Promise<EnchantOptions> {
  return requestJson(ENCHANT_OPTIONS_PATH, enchantOptionsSchema)
}

const enchantOptionsKey = ['lab-enchant-options'] as const

export function useEnchantOptions(): LoadedResult<EnchantOptions> {
  return useLoadedResult(enchantOptionsKey, requestEnchantOptions)
}
