import { delay, HttpResponse, http } from 'msw'
import { API_BASE_URL } from '#shared/api/dfragon-api'
import type { SkillStats } from '#entities/ranking/model/skill-stats'

export const SKILL_STATS_URL = `${API_BASE_URL}/stats/skills`

// 합성 통계다. 개화 스킬 이름만 쓰는 화면이 받는다.
export function evolutionSkillStats(names: readonly string[]): SkillStats {
  return {
    computedAt: '2026-11-18T15:38:47.900Z',
    minFame: null,
    sampleSize: 10,
    skills: [],
    evolutions: names.map((name) => ({ name, type1: 3, type2: 2 })),
    enhancements: [],
    chainSampleSize: 0,
    chains: []
  }
}

export const skillStatsHandlers = {
  of: (stats: SkillStats) => http.get(SKILL_STATS_URL, () => HttpResponse.json(stats)),
  loading: http.get(SKILL_STATS_URL, async () => {
    await delay('infinite')
  }),
  failure: http.get(SKILL_STATS_URL, () =>
    HttpResponse.json(
      { error: { code: 'INTERNAL_SERVER_ERROR', message: '스킬 통계를 받지 못했습니다.' } },
      { status: 500 }
    )
  )
}
