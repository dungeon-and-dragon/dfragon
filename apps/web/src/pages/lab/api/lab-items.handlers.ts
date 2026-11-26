import { delay, HttpResponse, http } from 'msw'
import { API_BASE_URL } from '#shared/api/dfragon-api'
import { LAB_CURRENCY_ICON_PATH, labItemsFixture } from './lab-items.fixture'
import { LAB_ITEMS_PATH } from './useLabItems'

export const LAB_ITEMS_URL = `${API_BASE_URL}${LAB_ITEMS_PATH}`

const LAB_CURRENCY_ICON_URL = `${API_BASE_URL}${LAB_CURRENCY_ICON_PATH.split('?')[0]}`

// story에서 재화 아이콘 자리를 보이려고 그린 합성 동전이다.
const SYNTHETIC_COIN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#c9d1d9" stroke="#6e7681" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="#6e7681" stroke-width="2"/></svg>'

export const labItemsHandlers = {
  items: http.get(LAB_ITEMS_URL, () => HttpResponse.json(labItemsFixture.items)),
  currencyIcon: http.get(
    LAB_CURRENCY_ICON_URL,
    () => new HttpResponse(SYNTHETIC_COIN_SVG, { headers: { 'Content-Type': 'image/svg+xml' } })
  ),
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
