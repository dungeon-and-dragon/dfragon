import { delay, HttpResponse, http } from 'msw'
import { API_BASE_URL } from '#shared/api/dfragon-api'
import { storyCharacterStats } from './stats.fixture'

export const CHARACTER_STATS_URL = `${API_BASE_URL}/stats`

const TWO_HOURS = 2 * 60 * 60 * 1000

export const characterStatsHandlers = {
  stats: http.get(CHARACTER_STATS_URL, () => {
    const computedAt = new Date(Date.now() - TWO_HOURS).toISOString()

    return HttpResponse.json(storyCharacterStats(computedAt))
  }),
  loading: http.get(CHARACTER_STATS_URL, async () => {
    await delay('infinite')
  }),
  failure: http.get(CHARACTER_STATS_URL, () =>
    HttpResponse.json(
      { error: { code: 'INTERNAL_SERVER_ERROR', message: '통계를 받지 못했습니다.' } },
      { status: 500 }
    )
  )
}
