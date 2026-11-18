import {
  type CharacterStatsSnapshot,
  type DatabaseClient,
  type FameRankingFilter,
  type FameRankingPosition,
  type JobSkillAdoptionQuery,
  type JobSkillAdoptionSnapshot,
  type SetAdoption,
  type SetAdoptionQuery,
  type RankedStoredCharacter,
  readCharacterStatsSnapshot,
  readFameRanking,
  readJobSkillAdoptionSnapshot,
  readSetAdoption
} from '@dfragon/database'
import type { RankingStatsRepository } from '#application/ranking-stats/repository.js'

export class DatabaseRankingStatsRepository implements RankingStatsRepository {
  constructor(private readonly client: DatabaseClient) {}

  readFameRanking(
    filter: FameRankingFilter,
    limit: number,
    after?: FameRankingPosition
  ): Promise<RankedStoredCharacter[]> {
    return readFameRanking(this.client, filter, limit, after)
  }

  readCharacterStatsSnapshot(): Promise<CharacterStatsSnapshot | null> {
    return readCharacterStatsSnapshot(this.client)
  }

  readJobSkillAdoptionSnapshot(
    job: JobSkillAdoptionQuery
  ): Promise<JobSkillAdoptionSnapshot | null> {
    return readJobSkillAdoptionSnapshot(this.client, job)
  }

  readSetAdoption(query: SetAdoptionQuery): Promise<SetAdoption> {
    return readSetAdoption(this.client, query)
  }
}
