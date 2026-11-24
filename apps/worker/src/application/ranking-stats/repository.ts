import type {
  CharacterSkillStyleInput,
  CharacterStats,
  CharacterStatsSnapshot,
  JobSkillAdoption,
  JobSkillAdoptionQuery,
  JobSkillAdoptionSnapshot,
  SetAdoptionReplacement,
  SkillStyleChainBackfillKey,
  SkillStyleChainBackfillRow,
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
  replaceSetAdoption(replacement: SetAdoptionReplacement): Promise<number>
  replaceItemAdoption(replacement: SetAdoptionReplacement): Promise<number>
}

export interface SkillStyleCollectionRepository {
  readTargets(): Promise<SkillStyleSampleCharacter[]>
  recordSkillStyle(style: CharacterSkillStyleInput): Promise<void>
}

export interface SkillChainBackfillRepository {
  readPage(page: {
    after: SkillStyleChainBackfillKey | null
    limit: number
  }): Promise<SkillStyleChainBackfillRow[]>
  fillChain(style: CharacterSkillStyleInput): Promise<boolean>
}
