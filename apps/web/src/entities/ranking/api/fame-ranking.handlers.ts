import { delay, HttpResponse, http } from 'msw'
import { API_BASE_URL } from '#shared/api/dfragon-api'
import { FAME_RANKING_NEXT_CURSOR, fameRankingFixture } from './fame-ranking.fixture'

export const FAME_RANKING_URL = `${API_BASE_URL}/rankings/fame`

export function fameRankingFailure(message: string): HttpResponse<object> {
  return HttpResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message } }, { status: 500 })
}

export const fameRankingHandlers = {
  pages: http.get(FAME_RANKING_URL, ({ request }) => {
    const cursor = new URL(request.url).searchParams.get('cursor')

    if (cursor === FAME_RANKING_NEXT_CURSOR) {
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
