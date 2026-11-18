import type {
  CharacterStatsSnapshot,
  FameRankingFilter,
  JobSkillAdoptionQuery,
  JobSkillAdoptionSnapshot,
  SetAdoption,
  SetAdoptionQuery,
  StoredCharacter
} from '@dfragon/database'

export interface RankingStatsRepository {
  readFameRanking(filter: FameRankingFilter, limit: number): Promise<StoredCharacter[]>
  readCharacterStatsSnapshot(): Promise<CharacterStatsSnapshot | null>
  readJobSkillAdoptionSnapshot(job: JobSkillAdoptionQuery): Promise<JobSkillAdoptionSnapshot | null>
  readSetAdoption(query: SetAdoptionQuery): Promise<SetAdoption>
}
