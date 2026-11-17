import {
  type CharacterBasicInput,
  type CharacterHistoryInput,
  type CharacterScoreInput,
  type CharacterSkillStyleInput,
  type DatabaseClient,
  recordCharacterBasic,
  recordCharacterHistory,
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

  recordHistory(history: CharacterHistoryInput): Promise<void> {
    return recordCharacterHistory(this.client, history)
  }
}
