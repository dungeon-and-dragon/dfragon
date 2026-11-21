import { HttpResponse, http } from 'msw'
import { API_BASE_URL } from '#shared/api/dfragon-api'
import { storyItemDetail } from './item-detail.fixture'

export const ITEM_DETAIL_URL = `${API_BASE_URL}/items/:itemId`

export const itemDetailHandlers = {
  detail: http.get(ITEM_DETAIL_URL, ({ params }) =>
    HttpResponse.json(storyItemDetail(String(params.itemId)))
  )
}
