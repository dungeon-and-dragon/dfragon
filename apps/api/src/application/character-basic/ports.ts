import type { CharacterBasicInput, CharacterSkillStyleInput } from '@dfragon/database'
import type { CharacterFetched } from '../../domain/character-events.js'

export type RecordCharacterBasic = (basic: CharacterBasicInput) => Promise<void>

export type RecordCharacterSkillStyle = (style: CharacterSkillStyleInput) => Promise<void>

export type CharacterRecordFailure =
  | 'CHARACTER_BASIC_RECORD_FAILED'
  | 'CHARACTER_SKILL_STYLE_RECORD_FAILED'

export type ParseCharacterBasic = (
  payload: Readonly<Record<string, unknown>>
) => CharacterBasicInput | undefined

export type ParseCharacterSkillStyle = (
  payload: Readonly<Record<string, unknown>>
) => Omit<CharacterSkillStyleInput, 'serverId' | 'characterId' | 'fetchedAt'> | undefined

export type RecordFetchedCharacterBasic = (event: CharacterFetched) => void
