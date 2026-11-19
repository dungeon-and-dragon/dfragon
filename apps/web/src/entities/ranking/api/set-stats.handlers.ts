import { delay, HttpResponse, http } from 'msw'
import { API_BASE_URL } from '#shared/api/dfragon-api'
import { storySetStats } from './set-stats.fixture'

export const SET_STATS_URL = `${API_BASE_URL}/stats/sets`

export const setStatsHandlers = {
  statsComputedAgo: (ageMs: number) =>
    http.get(SET_STATS_URL, () => {
      const computedAt = new Date(Date.now() - ageMs).toISOString()

      return HttpResponse.json(storySetStats(computedAt))
    }),
  empty: http.get(SET_STATS_URL, () =>
    HttpResponse.json({
      computedAt: null,
      sampleSize: 0,
      equipmentSets: [],
      oathSets: [],
      combos: []
    })
  ),
  loading: http.get(SET_STATS_URL, async () => {
    await delay('infinite')
  }),
  failure: http.get(SET_STATS_URL, () =>
    HttpResponse.json(
      { error: { code: 'INTERNAL_SERVER_ERROR', message: '세트 통계를 받지 못했습니다.' } },
      { status: 500 }
    )
  )
}
