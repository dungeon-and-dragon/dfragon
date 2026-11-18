import type {
  CharacterBasicInput,
  CharacterHistoryInput,
  CharacterScoreInput,
  CharacterSetsInput,
  CharacterSkillStyleInput
} from '@dfragon/database'

export interface CharacterBasicRepository {
  recordBasic(basic: CharacterBasicInput): Promise<void>
  recordSkillStyle(style: CharacterSkillStyleInput): Promise<void>
  recordScore(score: CharacterScoreInput): Promise<void>
  recordHistory(history: CharacterHistoryInput): Promise<void>
  recordSets(sets: CharacterSetsInput): Promise<void>
}
