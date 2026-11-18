import {
  type CharacterSkillStyleInput,
  type DatabaseClient,
  type SkillStyleSampleCharacter,
  readSampleCharactersWithoutSkillStyle,
  recordCharacterSkillStyle
} from '@dfragon/database'
import type { SkillStyleCollectionRepository } from '../../application/ranking-stats/repository.js'

export class DatabaseSkillStyleCollectionRepository implements SkillStyleCollectionRepository {
  constructor(private readonly client: DatabaseClient) {}

  readTargets(): Promise<SkillStyleSampleCharacter[]> {
    return readSampleCharactersWithoutSkillStyle(this.client)
  }

  recordSkillStyle(style: CharacterSkillStyleInput): Promise<void> {
    return recordCharacterSkillStyle(this.client, style)
  }
}
