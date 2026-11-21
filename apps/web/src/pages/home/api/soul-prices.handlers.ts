import { delay, HttpResponse, http } from 'msw'
import { API_BASE_URL } from '#shared/api/dfragon-api'
import { soulPricesFixture } from './soul-prices.fixture'
import { SOUL_PRICES_PATH } from './useSoulPrices'

export const SOUL_PRICES_URL = `${API_BASE_URL}${SOUL_PRICES_PATH}`

export const soulPricesHandlers = {
  prices: http.get(SOUL_PRICES_URL, () =>
    HttpResponse.json({ crystals: soulPricesFixture.crystals })
  ),
  loading: http.get(SOUL_PRICES_URL, async () => {
    await delay('infinite')
  }),
  failure: http.get(SOUL_PRICES_URL, () =>
    HttpResponse.json(
      { error: { code: 'NEOPLE_API_ERROR', message: soulPricesFixture.failureMessage } },
      { status: 502 }
    )
  )
}
