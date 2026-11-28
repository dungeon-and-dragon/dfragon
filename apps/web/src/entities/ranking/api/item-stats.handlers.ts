import { delay, HttpResponse, http } from 'msw'
import { API_BASE_URL } from '#shared/api/dfragon-api'
import { storyItemStats } from './item-stats.fixture'

export const ITEM_STATS_URL = `${API_BASE_URL}/stats/items`

export const itemStatsHandlers = {
  statsComputedAgo: (ageMs: number) =>
    http.get(ITEM_STATS_URL, () => {
      const computedAt = new Date(Date.now() - ageMs).toISOString()

      return HttpResponse.json(storyItemStats(computedAt))
    }),
  empty: http.get(ITEM_STATS_URL, () =>
    HttpResponse.json({ computedAt: null, sampleSize: 0, slots: [] })
  ),
  loading: http.get(ITEM_STATS_URL, async () => {
    await delay('infinite')
  }),
  failure: http.get(ITEM_STATS_URL, () =>
    HttpResponse.json(
      { error: { code: 'INTERNAL_SERVER_ERROR', message: '아이템 통계를 받지 못했습니다.' } },
      { status: 500 }
    )
  )
}
