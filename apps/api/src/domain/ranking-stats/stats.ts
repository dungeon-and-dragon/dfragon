import type { RankingSort } from '@dfragon/database'

export const RANKING_SORTS = [
  'fame',
  'equipmentScore',
  'buffScore'
] as const satisfies readonly RankingSort[]

export const FAME_RANKING_PAGE_SIZE = 20
