import type {
  CharacterSkillStyleInput,
  CharacterStats,
  CharacterStatsSnapshot,
  JobSkillAdoption,
  JobSkillAdoptionQuery,
  JobSkillAdoptionSnapshot,
  SkillStyleSampleCharacter,
  SkillStyleSampleJob
} from '@dfragon/database'

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
