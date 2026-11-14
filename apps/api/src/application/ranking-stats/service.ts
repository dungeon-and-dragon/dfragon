import type {
  CharacterStatsSnapshot,
  FameRankingFilter,
  JobSkillAdoptionQuery,
  JobSkillAdoptionSnapshot,
  StoredCharacter
} from '@dfragon/database'
import { FAME_RANKING_LIMIT } from '../../domain/ranking-stats/stats.js'
import type { RankingStatsRepository } from './repository.js'

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
}

export const emptyRankingStatsRepository: RankingStatsRepository = {
  readFameRanking: async () => [],
  readCharacterStatsSnapshot: async () => null,
  readJobSkillAdoptionSnapshot: async () => null
}
