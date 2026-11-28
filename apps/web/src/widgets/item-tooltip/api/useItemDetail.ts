import { createJsonRequest } from '#shared/api/json-request'
import { API_BASE_URL, dfragonHttp } from '#shared/api/dfragon-api'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'
import { type ItemDetail, itemDetailSchema } from '#widgets/item-tooltip/model/item-detail'

const requestJson = createJsonRequest(dfragonHttp, API_BASE_URL)

export function useItemDetail(itemId: string): LoadedResult<ItemDetail> {
  return useLoadedResult(['item-detail', itemId], () =>
    // 공개 API 요청은 기본으로 HTTP 캐시를 건너뛰지만, 아이템 정보는 API가 정한 기간 동안 다시 받지 않는다.
    requestJson(`/items/${itemId}`, itemDetailSchema, { cache: 'default' })
  )
}
