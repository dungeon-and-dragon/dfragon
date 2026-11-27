import { delay, HttpResponse, http } from 'msw'
import { API_BASE_URL } from '#shared/api/dfragon-api'
import {
  ENCHANT_CARD_ICON_PATH,
  ENCHANT_CURRENCY_ICON_PATH,
  enchantOptionsFixture
} from './enchant-options.fixture'
import { ENCHANT_OPTIONS_PATH, type EnchantOptionsResponse } from './useEnchantOptions'

export const ENCHANT_OPTIONS_URL = `${API_BASE_URL}${ENCHANT_OPTIONS_PATH}`

const CARD_ICON_URL = `${API_BASE_URL}${ENCHANT_CARD_ICON_PATH.split('?')[0]}`
const CURRENCY_ICON_URL = `${API_BASE_URL}${ENCHANT_CURRENCY_ICON_PATH.split('?')[0]}`

// story에서 아이콘 자리를 보이려고 그린 합성 그림이다.
const SYNTHETIC_ORB_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><circle cx="14" cy="14" r="10" fill="#8b5cf6" stroke="#4c1d95" stroke-width="2"/></svg>'
const SYNTHETIC_COIN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#c9d1d9" stroke="#6e7681" stroke-width="2"/></svg>'

function svg(body: string) {
  return () => new HttpResponse(body, { headers: { 'Content-Type': 'image/svg+xml' } })
}

export const enchantOptionsHandlers = {
  options: (response: EnchantOptionsResponse = enchantOptionsFixture) => [
    http.get(ENCHANT_OPTIONS_URL, () => HttpResponse.json(response)),
    http.get(CARD_ICON_URL, svg(SYNTHETIC_ORB_SVG)),
    http.get(CURRENCY_ICON_URL, svg(SYNTHETIC_COIN_SVG))
  ],
  loading: http.get(ENCHANT_OPTIONS_URL, async () => {
    await delay('infinite')
  }),
  failure: http.get(ENCHANT_OPTIONS_URL, () =>
    HttpResponse.json(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '마법부여 목록 조회 중 오류가 발생했습니다.'
        }
      },
      { status: 500 }
    )
  )
}
