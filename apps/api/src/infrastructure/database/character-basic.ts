import {
  type CharacterBasicInput,
  type CharacterScoreInput,
  type CharacterSkillStyleInput,
  type DatabaseClient,
  recordCharacterBasic,
  recordCharacterScore,
  recordCharacterSkillStyle
} from '@dfragon/database'
import type { CharacterBasicRepository } from '../../application/character-basic/repository.js'

export class DatabaseCharacterBasicRepository implements CharacterBasicRepository {
  constructor(private readonly client: DatabaseClient) {}

  recordBasic(basic: CharacterBasicInput): Promise<void> {
    return recordCharacterBasic(this.client, basic)
  }

  recordSkillStyle(style: CharacterSkillStyleInput): Promise<void> {
    return recordCharacterSkillStyle(this.client, style)
  }

  recordScore(score: CharacterScoreInput): Promise<void> {
    return recordCharacterScore(this.client, score)
  }
}
