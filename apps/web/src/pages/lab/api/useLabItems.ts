import { LAB_ITEM_CATEGORIES, LAB_ITEM_ROLES, LAB_ITEM_TIERS } from '@dfragon/lib/lab-items'
import { z } from 'zod'
import { createJsonRequest } from '#shared/api/json-request'
import { API_BASE_URL, dfragonHttp } from '#shared/api/dfragon-api'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'

export const LAB_ITEMS_PATH = '/lab/items'

// API는 자기 origin 기준 경로를 주므로, 화면이 바로 쓰게 API 주소를 붙인다.
const currencyCostSchema = z
  .object({ currencyName: z.string(), count: z.number().int().positive(), iconPath: z.string() })
  .transform(({ currencyName, count, iconPath }) => {
    const iconUrl = `${API_BASE_URL}${iconPath}`

    return { currencyName, count, iconUrl }
  })

const labItemsSchema = z.object({
  groups: z.array(
    z.object({
      category: z.enum(LAB_ITEM_CATEGORIES),
      role: z.enum(LAB_ITEM_ROLES),
      tier: z.enum(LAB_ITEM_TIERS),
      items: z.array(
        z.object({
          itemName: z.string(),
          itemId: z.string().nullable(),
          itemRarity: z.string().nullable(),
          unitPrice: z.number().int().positive().nullable(),
          checkedAt: z.iso.datetime().nullable(),
          cost: currencyCostSchema.nullable()
        })
      )
    })
  )
})

export type LabItemsResponse = z.input<typeof labItemsSchema>
export type LabItems = z.output<typeof labItemsSchema>
export type LabItemGroup = LabItems['groups'][number]
export type LabItem = LabItemGroup['items'][number]
export type LabCurrencyCost = NonNullable<LabItem['cost']>

const requestJson = createJsonRequest(dfragonHttp, API_BASE_URL)

function requestLabItems(): Promise<LabItems> {
  return requestJson(LAB_ITEMS_PATH, labItemsSchema)
}

// 서버가 화면을 그리기 전에 받아 둘 때와 화면의 hook이 같은 key와 요청을 쓴다.
export const labItemsQuery = { queryKey: ['lab-items'], queryFn: requestLabItems } as const

export function useLabItems(): LoadedResult<LabItems> {
  return useLoadedResult(labItemsQuery.queryKey, labItemsQuery.queryFn)
}
