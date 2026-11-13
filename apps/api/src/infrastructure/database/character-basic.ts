import {
  type DatabaseClient,
  recordCharacterBasic,
  recordCharacterScore,
  recordCharacterSkillStyle
} from '@dfragon/database'
import type {
  RecordCharacterBasic,
  RecordCharacterScore,
  RecordCharacterSkillStyle
} from '../../application/character-basic/ports.js'

export function createDatabaseCharacterBasicStore(client: DatabaseClient): {
  recordBasic: RecordCharacterBasic
  recordSkillStyle: RecordCharacterSkillStyle
  recordScore: RecordCharacterScore
} {
  return {
    recordBasic: (basic) => recordCharacterBasic(client, basic),
    recordSkillStyle: (style) => recordCharacterSkillStyle(client, style),
    recordScore: (score) => recordCharacterScore(client, score)
  }
}
