import type {
  StoredCharacterHistory,
  StoredCharacterSection,
  StoredCharacterHistorySnapshot,
  TimelineEventRow
} from '@dfragon/database'
import type { CharacterIdentity } from '../../domain/character-identity.js'

export interface CharacterHistoryRepository {
  readHistory(character: CharacterIdentity): Promise<StoredCharacterHistory>
  readSnapshot(
    character: CharacterIdentity,
    at: Date
  ): Promise<StoredCharacterHistorySnapshot | null>
  readNameChangeEvents(character: CharacterIdentity): Promise<TimelineEventRow[]>
  readSections(
    character: CharacterIdentity,
    sections: readonly string[]
  ): Promise<StoredCharacterSection[]>
}

export const emptyCharacterHistoryRepository: CharacterHistoryRepository = {
  readHistory: async () => ({ basics: [], scores: [], sectionChanges: [] }),
  readSnapshot: async () => null,
  readNameChangeEvents: async () => [],
  readSections: async () => []
}
