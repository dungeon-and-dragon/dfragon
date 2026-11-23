import { createJsonRequest } from '#shared/api/json-request'
import { API_BASE_URL, dfragonHttp } from '#shared/api/dfragon-api'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'
import { type ItemDetail, itemDetailSchema } from '#widgets/item-tooltip/model/item-detail'

const requestJson = createJsonRequest(dfragonHttp, API_BASE_URL)

export function useItemDetail(itemId: string): LoadedResult<ItemDetail> {
  return useLoadedResult(['item-detail', itemId], () =>
    requestJson(`/items/${itemId}`, itemDetailSchema)
  )
}
