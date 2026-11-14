import type {
  CharacterStatsSnapshot,
  FameRankingFilter,
  JobSkillAdoptionQuery,
  JobSkillAdoptionSnapshot,
  StoredCharacter,
  CharacterSkillStyleInput,
  SkillStyleSampleCharacter
} from '@dfragon/database'

export interface RankingStatsReader {
  readFameRanking(filter: FameRankingFilter, limit: number): Promise<StoredCharacter[]>
  readCharacterStatsSnapshot(): Promise<CharacterStatsSnapshot | null>
  readJobSkillAdoptionSnapshot(job: JobSkillAdoptionQuery): Promise<JobSkillAdoptionSnapshot | null>
}

export type FetchedSkillStyle =
  | { status: 'fetched'; style: CharacterSkillStyleInput }
  | { status: 'skipped' }
  | { status: 'unavailable' }

export type FetchSkillStyle = (
  character: SkillStyleSampleCharacter,
  now: () => Date
) => Promise<FetchedSkillStyle>

export type SkillStyleCollectionPorts = {
  fetchSkillStyle: FetchSkillStyle
  readConcurrency: () => number
  now: () => Date
  pause: (ms: number) => Promise<void>
  report: (code: string, details: Readonly<Record<string, string | number>>) => void
}
