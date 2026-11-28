import {
  type CharacterStatsSnapshot,
  type DatabaseClient,
  type FameRankingFilter,
  type ItemAdoption,
  type JobSkillAdoptionQuery,
  type JobSkillAdoptionSnapshot,
  type SetAdoption,
  type SetAdoptionQuery,
  type RankedStoredCharacter,
  countFameRanking,
  readCharacterStatsSnapshot,
  readFameRanking,
  readItemAdoption,
  readJobSkillAdoptionSnapshot,
  readSetAdoption
} from '@dfragon/database'
import type { RankingStatsRepository } from '#application/ranking-stats/repository.js'

export class DatabaseRankingStatsRepository implements RankingStatsRepository {
  constructor(private readonly client: DatabaseClient) {}

  readFameRanking(
    filter: FameRankingFilter,
    limit: number,
    offset: number
  ): Promise<RankedStoredCharacter[]> {
    return readFameRanking(this.client, filter, limit, offset)
  }

  countFameRanking(filter: FameRankingFilter): Promise<number> {
    return countFameRanking(this.client, filter)
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

  readItemAdoption(query: SetAdoptionQuery): Promise<ItemAdoption> {
    return readItemAdoption(this.client, query)
  }
}
