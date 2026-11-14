import {
  type CharacterStatsSnapshot,
  type DatabaseClient,
  type FameRankingFilter,
  type JobSkillAdoptionQuery,
  type JobSkillAdoptionSnapshot,
  type StoredCharacter,
  readCharacterStatsSnapshot,
  readFameRanking,
  readJobSkillAdoptionSnapshot
} from '@dfragon/database'
import type { RankingStatsRepository } from '../../application/ranking-stats/repository.js'

export class DatabaseRankingStatsRepository implements RankingStatsRepository {
  constructor(private readonly client: DatabaseClient) {}

  readFameRanking(filter: FameRankingFilter, limit: number): Promise<StoredCharacter[]> {
    return readFameRanking(this.client, filter, limit)
  }

  readCharacterStatsSnapshot(): Promise<CharacterStatsSnapshot | null> {
    return readCharacterStatsSnapshot(this.client)
  }

  readJobSkillAdoptionSnapshot(
    job: JobSkillAdoptionQuery
  ): Promise<JobSkillAdoptionSnapshot | null> {
    return readJobSkillAdoptionSnapshot(this.client, job)
  }
}
