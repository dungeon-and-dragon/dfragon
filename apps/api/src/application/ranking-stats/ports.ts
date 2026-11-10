import type {
  CharacterStats,
  CharacterStatsSnapshot,
  FameRankingFilter,
  JobSkillAdoption,
  JobSkillAdoptionQuery,
  JobSkillAdoptionSnapshot,
  SkillStyleSampleJob,
  StoredCharacter,
  CharacterSkillStyleInput,
  SkillStyleSampleCharacter
} from '@dfragon/database'

export interface RankingStatsReader {
  readFameRanking(filter: FameRankingFilter, limit: number): Promise<StoredCharacter[]>
  readCharacterStatsSnapshot(): Promise<CharacterStatsSnapshot | null>
  readJobSkillAdoptionSnapshot(job: JobSkillAdoptionQuery): Promise<JobSkillAdoptionSnapshot | null>
}

export type StatsJobStore = {
  readCharacterStats(): Promise<CharacterStats>
  saveCharacterStats(snapshot: CharacterStatsSnapshot): Promise<void>
  readFamedJobGrows(): Promise<SkillStyleSampleJob[]>
  readJobSkillAdoption(job: JobSkillAdoptionQuery): Promise<JobSkillAdoption>
  saveJobSkillAdoption(snapshot: JobSkillAdoptionSnapshot): Promise<void>
  deleteJobSkillAdoptionComputedBefore(before: Date): Promise<number>
}

export type FetchedSkillStyle =
  | { status: 'fetched'; style: CharacterSkillStyleInput }
  | { status: 'skipped' }
  | { status: 'unavailable' }

export type FetchSkillStyle = (
  character: SkillStyleSampleCharacter,
  now: () => Date
) => Promise<FetchedSkillStyle>

export type SkillStyleCollectionStore = {
  readTargets(): Promise<SkillStyleSampleCharacter[]>
  recordSkillStyle(style: CharacterSkillStyleInput): Promise<void>
}

export type SkillStyleCollectionJobDependencies = {
  fetchSkillStyle: FetchSkillStyle
  concurrency: number
  report: (code: string, details: Readonly<Record<string, string | number>>) => void
}

export type SkillStyleCollectionDependencies = SkillStyleCollectionJobDependencies & {
  store: SkillStyleCollectionStore
  now: () => Date
  pause: (ms: number) => Promise<void>
  reportProgress: (done: number, total: number) => void
}
