import { z } from 'zod'
import { createJsonRequest } from '#shared/api/json-request'
import { API_BASE_URL, dfragonHttp } from '#shared/api/dfragon-api'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'

export const SOUL_PRICES_PATH = '/items/soul-prices'

const soulPricesSchema = z.object({
  crystals: z.array(
    z.object({
      itemId: z.string().nullable(),
      itemName: z.string(),
      itemRarity: z.string().nullable(),
      unitPrice: z.number().int().positive().nullable(),
      revelationCount: z.number().int().positive()
    })
  )
})

export type SoulPrice = z.output<typeof soulPricesSchema>['crystals'][number]

const requestJson = createJsonRequest(dfragonHttp, API_BASE_URL)

async function requestSoulPrices(): Promise<readonly SoulPrice[]> {
  const { crystals } = await requestJson(SOUL_PRICES_PATH, soulPricesSchema)

  return crystals
}

export function useSoulPrices(): LoadedResult<readonly SoulPrice[]> {
  return useLoadedResult(['soul-prices'], requestSoulPrices)
}
