import type {
  CharacterStatsSnapshot,
  FameRankingFilter,
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
    offset: number
  ): Promise<RankedStoredCharacter[]>
  countFameRanking(filter: FameRankingFilter): Promise<number>
  readCharacterStatsSnapshot(): Promise<CharacterStatsSnapshot | null>
  readJobSkillAdoptionSnapshot(job: JobSkillAdoptionQuery): Promise<JobSkillAdoptionSnapshot | null>
  readSetAdoption(query: SetAdoptionQuery): Promise<SetAdoption>
  readItemAdoption(query: SetAdoptionQuery): Promise<ItemAdoption>
}
