import { delay, HttpResponse, http } from 'msw'
import { API_BASE_URL } from '#shared/api/dfragon-api'
import { labItemsFixture } from './lab-items.fixture'
import { LAB_ITEMS_PATH } from './useLabItems'

export const LAB_ITEMS_URL = `${API_BASE_URL}${LAB_ITEMS_PATH}`

export const labItemsHandlers = {
  items: http.get(LAB_ITEMS_URL, () => HttpResponse.json(labItemsFixture.items)),
  empty: http.get(LAB_ITEMS_URL, () => HttpResponse.json({ groups: [] })),
  loading: http.get(LAB_ITEMS_URL, async () => {
    await delay('infinite')
  }),
  failure: http.get(LAB_ITEMS_URL, () =>
    HttpResponse.json(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '실험실 아이템 조회 중 오류가 발생했습니다.'
        }
      },
      { status: 500 }
    )
  )
}
