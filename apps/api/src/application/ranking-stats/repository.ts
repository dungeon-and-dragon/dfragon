import type {
  CharacterSkillStyleInput,
  CharacterStats,
  CharacterStatsSnapshot,
  FameRankingFilter,
  JobSkillAdoption,
  JobSkillAdoptionQuery,
  JobSkillAdoptionSnapshot,
  SkillStyleSampleCharacter,
  SkillStyleSampleJob,
  StoredCharacter
} from '@dfragon/database'

export interface RankingStatsRepository {
  readFameRanking(filter: FameRankingFilter, limit: number): Promise<StoredCharacter[]>
  readCharacterStatsSnapshot(): Promise<CharacterStatsSnapshot | null>
  readJobSkillAdoptionSnapshot(job: JobSkillAdoptionQuery): Promise<JobSkillAdoptionSnapshot | null>
}

export interface StatsJobRepository {
  readCharacterStats(): Promise<CharacterStats>
  saveCharacterStats(snapshot: CharacterStatsSnapshot): Promise<void>
  readFamedJobGrows(): Promise<SkillStyleSampleJob[]>
  readJobSkillAdoption(job: JobSkillAdoptionQuery): Promise<JobSkillAdoption>
  saveJobSkillAdoption(snapshot: JobSkillAdoptionSnapshot): Promise<void>
  deleteJobSkillAdoptionComputedBefore(before: Date): Promise<number>
}

export interface SkillStyleCollectionRepository {
  readTargets(): Promise<SkillStyleSampleCharacter[]>
  recordSkillStyle(style: CharacterSkillStyleInput): Promise<void>
}
