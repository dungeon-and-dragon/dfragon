import type {
  CharacterStatsSnapshot,
  FameRankingFilter,
  JobSkillAdoptionQuery,
  JobSkillAdoptionSnapshot,
  SetAdoption,
  SetAdoptionQuery,
  StoredCharacter
} from '@dfragon/database'
import { FAME_RANKING_LIMIT } from '#domain/ranking-stats/index.js'
import type { RankingStatsRepository } from './repository.js'

const emptySetAdoption: SetAdoption = {
  computedAt: null,
  sampleSize: 0,
  equipmentSets: [],
  oathSets: [],
  combos: []
}

export class RankingStatsService {
  constructor(private readonly repository: RankingStatsRepository) {}

  fameRanking(filter: FameRankingFilter): Promise<StoredCharacter[]> {
    return this.repository.readFameRanking(filter, FAME_RANKING_LIMIT)
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
}

export const emptyRankingStatsRepository: RankingStatsRepository = {
  readFameRanking: async () => [],
  readCharacterStatsSnapshot: async () => null,
  readJobSkillAdoptionSnapshot: async () => null,
  readSetAdoption: async () => emptySetAdoption
}
