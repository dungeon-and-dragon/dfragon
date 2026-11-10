import {
  type DatabaseClient,
  readSampleCharactersWithoutSkillStyle,
  recordCharacterSkillStyle
} from '@dfragon/database'
import type { SkillStyleCollectionStore } from '../../application/ranking-stats/ports.js'

export function createDatabaseSkillStyleCollectionStore(
  client: DatabaseClient
): SkillStyleCollectionStore {
  return {
    readTargets: () => readSampleCharactersWithoutSkillStyle(client),
    recordSkillStyle: (style) => recordCharacterSkillStyle(client, style)
  }
}
