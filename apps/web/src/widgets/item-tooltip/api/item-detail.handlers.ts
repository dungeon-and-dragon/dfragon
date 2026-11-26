import { HttpResponse, http } from 'msw'
import { API_BASE_URL } from '#shared/api/dfragon-api'
import { STORY_CARD_ITEM_ID, storyCardDetail, storyItemDetail } from './item-detail.fixture'

export const ITEM_DETAIL_URL = `${API_BASE_URL}/items/:itemId`

export const itemDetailHandlers = {
  detail: http.get(ITEM_DETAIL_URL, ({ params }) => {
    const itemId = String(params.itemId)

    if (itemId === STORY_CARD_ITEM_ID) {
      return HttpResponse.json(storyCardDetail(itemId))
    }

    return HttpResponse.json(storyItemDetail(itemId))
  })
}
