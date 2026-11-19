import { HttpResponse, http } from 'msw'
import { API_BASE_URL } from '#shared/api/dfragon-api'

export const TODAY_GRADE_URL = `${API_BASE_URL}/items/today-grade`

export const todayGradeHandlers = {
  grade: (percent: number) =>
    http.get(TODAY_GRADE_URL, () =>
      HttpResponse.json({ percent, expiresAt: '2999-01-01T00:00:00.000Z' })
    )
}
