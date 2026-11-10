import {
  type DatabaseClient,
  recordCharacterBasic,
  recordCharacterSkillStyle
} from '@dfragon/database'
import type {
  RecordCharacterBasic,
  RecordCharacterSkillStyle
} from '../../application/character-basic/ports.js'

export function createDatabaseCharacterBasicStore(client: DatabaseClient): {
  recordBasic: RecordCharacterBasic
  recordSkillStyle: RecordCharacterSkillStyle
} {
  return {
    recordBasic: (basic) => recordCharacterBasic(client, basic),
    recordSkillStyle: (style) => recordCharacterSkillStyle(client, style)
  }
}
