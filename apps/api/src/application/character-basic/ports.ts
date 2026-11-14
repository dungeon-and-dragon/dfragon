import type { CharacterBasicInput, CharacterSkillStyleInput } from '@dfragon/database'

export type CharacterRecordFailure =
  | 'CHARACTER_BASIC_RECORD_FAILED'
  | 'CHARACTER_SKILL_STYLE_RECORD_FAILED'
  | 'CHARACTER_SCORE_RECORD_FAILED'

export type ParseCharacterBasic = (
  payload: Readonly<Record<string, unknown>>
) => CharacterBasicInput | undefined

export type ParseCharacterSkillStyle = (
  payload: Readonly<Record<string, unknown>>
) => Omit<CharacterSkillStyleInput, 'serverId' | 'characterId' | 'fetchedAt'> | undefined
