import { delay, HttpResponse, http } from 'msw'
import { API_BASE_URL } from '#shared/api/dfragon-api'
import { fameRankingFixture } from './fame-ranking.fixture'

export const FAME_RANKING_URL = `${API_BASE_URL}/rankings/fame`

export function fameRankingFailure(message: string): HttpResponse<object> {
  return HttpResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message } }, { status: 500 })
}

export const fameRankingHandlers = {
  pages: http.get(FAME_RANKING_URL, ({ request }) => {
    const page = new URL(request.url).searchParams.get('page')

    if (page === '2') {
      return HttpResponse.json(fameRankingFixture.secondPage)
    }

    if (page === '3') {
      return HttpResponse.json(fameRankingFixture.lastPage)
    }

    return HttpResponse.json(fameRankingFixture.firstPage)
  }),
  empty: http.get(FAME_RANKING_URL, () => HttpResponse.json(fameRankingFixture.empty)),
  loading: http.get(FAME_RANKING_URL, async () => {
    await delay('infinite')
  }),
  failure: http.get(FAME_RANKING_URL, () => fameRankingFailure(fameRankingFixture.failureMessage))
}
