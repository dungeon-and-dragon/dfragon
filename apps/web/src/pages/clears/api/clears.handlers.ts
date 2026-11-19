import { delay, HttpResponse, http } from 'msw'
import { API_BASE_URL } from '#shared/api/dfragon-api'
import { storyClearContentStats, storyClearOverview, storyClearStats } from './clears.fixture'

export const CLEAR_STATS_URL = `${API_BASE_URL}/stats/clears`
export const CLEAR_OVERVIEW_URL = `${API_BASE_URL}/stats/clears/overview`
export const CLEAR_CONTENT_STATS_URL = `${API_BASE_URL}/stats/clears/:contentId`

function weekOf(request: Request): string | null {
  return new URL(request.url).searchParams.get('week')
}

export const clearStatsHandlers = {
  stats: [
    http.get(CLEAR_STATS_URL, () => HttpResponse.json(storyClearStats)),
    http.get(CLEAR_OVERVIEW_URL, ({ request }) => {
      const overview = storyClearOverview(weekOf(request) ?? '')

      return HttpResponse.json(overview)
    }),
    http.get(CLEAR_CONTENT_STATS_URL, ({ params, request }) => {
      const stats = storyClearContentStats(String(params.contentId), weekOf(request) ?? '')

      return HttpResponse.json(stats)
    })
  ],
  loading: [CLEAR_STATS_URL, CLEAR_OVERVIEW_URL, CLEAR_CONTENT_STATS_URL].map((url) =>
    http.get(url, async () => {
      await delay('infinite')
    })
  )
}
