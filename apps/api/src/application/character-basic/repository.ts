import type {
  CharacterBasicInput,
  CharacterScoreInput,
  CharacterSkillStyleInput
} from '@dfragon/database'

export interface CharacterBasicRepository {
  recordBasic(basic: CharacterBasicInput): Promise<void>
  recordSkillStyle(style: CharacterSkillStyleInput): Promise<void>
  recordScore(score: CharacterScoreInput): Promise<void>
}
