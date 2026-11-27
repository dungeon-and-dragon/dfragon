import type {
  CharacterBasicInput,
  CharacterSets,
  CharacterSkillStyleInput
} from '@dfragon/database'
import type { CharacterPayloads } from '#domain/character-detail/index.js'

export type CharacterRecordFailure =
  | 'CHARACTER_BASIC_RECORD_FAILED'
  | 'CHARACTER_SKILL_STYLE_RECORD_FAILED'
  | 'CHARACTER_SCORE_RECORD_FAILED'
  | 'CHARACTER_HISTORY_RECORD_FAILED'
  | 'CHARACTER_SETS_RECORD_FAILED'

export type ParseCharacterBasic = (
  payload: Readonly<Record<string, unknown>>
) => CharacterBasicInput | undefined

export type ParseCharacterSkillStyle = (
  payload: Readonly<Record<string, unknown>>
) => Omit<CharacterSkillStyleInput, 'serverId' | 'characterId' | 'fetchedAt'> | undefined

export type ParseCharacterSets = (
  payloads: Pick<CharacterPayloads, 'equipment' | 'oath' | 'avatar' | 'creature'>
) => CharacterSets | undefined
