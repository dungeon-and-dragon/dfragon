import type { CharacterSkillStyleInput, SkillStyleSampleCharacter } from '@dfragon/database'

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
