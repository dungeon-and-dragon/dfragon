import type {
  CharacterStatsSnapshot,
  FameRankingFilter,
  FameRankingPosition,
  ItemAdoption,
  JobSkillAdoptionQuery,
  JobSkillAdoptionSnapshot,
  SetAdoption,
  SetAdoptionQuery,
  RankedStoredCharacter
} from '@dfragon/database'

export interface RankingStatsRepository {
  readFameRanking(
    filter: FameRankingFilter,
    limit: number,
    after?: FameRankingPosition
  ): Promise<RankedStoredCharacter[]>
  readCharacterStatsSnapshot(): Promise<CharacterStatsSnapshot | null>
  readJobSkillAdoptionSnapshot(job: JobSkillAdoptionQuery): Promise<JobSkillAdoptionSnapshot | null>
  readSetAdoption(query: SetAdoptionQuery): Promise<SetAdoption>
  readItemAdoption(query: SetAdoptionQuery): Promise<ItemAdoption>
}
