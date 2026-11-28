import { LRUCache } from 'lru-cache'
import type {
  CharacterStatsSnapshot,
  FameRankingFilter,
  ItemAdoption,
  RankedStoredCharacter,
  JobSkillAdoptionQuery,
  JobSkillAdoptionSnapshot,
  SetAdoption,
  SetAdoptionQuery
} from '@dfragon/database'
import { FAME_RANKING_PAGE_SIZE } from '#domain/ranking-stats/index.js'
import type { RankingStatsRepository } from './repository.js'

const emptyItemAdoption: ItemAdoption = { computedAt: null, sampleSize: 0, slots: [] }

const emptySetAdoption: SetAdoption = {
  computedAt: null,
  sampleSize: 0,
  equipmentSets: [],
  oathSets: [],
  combos: []
}

export type FameRankingPage = {
  characters: RankedStoredCharacter[]
  pageCount: number
}

// 운영 476만 명을 세는 데 필터 없이 0.43초, 장비 점수 기준이면 0.85초가 걸려(2026-11-29) 필터마다 잠시 기억한다.
// 순위는 수집 job이 바꾸므로 몇 분 늦은 페이지 수는 목록에 영향이 작다.
const FAME_RANKING_COUNT_TTL_MS = 5 * 60 * 1000
const FAME_RANKING_COUNT_MAX_FILTERS = 1_000

export class RankingStatsService {
  private readonly counts: LRUCache<string, number, FameRankingFilter>

  constructor(private readonly repository: RankingStatsRepository) {
    this.counts = new LRUCache({
      max: FAME_RANKING_COUNT_MAX_FILTERS,
      ttl: FAME_RANKING_COUNT_TTL_MS,
      fetchMethod: (_key, _stale, { context }) => this.repository.countFameRanking(context)
    })
  }

  // 마지막 페이지 뒤의 OFFSET은 목록 전체를 훑으므로 세어 둔 수를 넘으면 읽지 않는다.
  async fameRanking(filter: FameRankingFilter, page: number): Promise<FameRankingPage> {
    const total = await this.counts.fetch(JSON.stringify(filter), { context: filter })
    const pageCount = Math.ceil((total ?? 0) / FAME_RANKING_PAGE_SIZE)

    if (page > pageCount) {
      return { characters: [], pageCount }
    }

    const offset = (page - 1) * FAME_RANKING_PAGE_SIZE
    const characters = await this.repository.readFameRanking(filter, FAME_RANKING_PAGE_SIZE, offset)

    return { characters, pageCount }
  }

  stats(): Promise<CharacterStatsSnapshot | null> {
    return this.repository.readCharacterStatsSnapshot()
  }

  skillStats(job: JobSkillAdoptionQuery): Promise<JobSkillAdoptionSnapshot | null> {
    return this.repository.readJobSkillAdoptionSnapshot(job)
  }

  setStats(query: SetAdoptionQuery): Promise<SetAdoption> {
    return this.repository.readSetAdoption(query)
  }

  itemStats(query: SetAdoptionQuery): Promise<ItemAdoption> {
    return this.repository.readItemAdoption(query)
  }
}

export const emptyRankingStatsRepository: RankingStatsRepository = {
  readFameRanking: async () => [],
  countFameRanking: async () => 0,
  readCharacterStatsSnapshot: async () => null,
  readJobSkillAdoptionSnapshot: async () => null,
  readSetAdoption: async () => emptySetAdoption,
  readItemAdoption: async () => emptyItemAdoption
}
