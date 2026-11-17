import type {
  StoredCharacterHistory,
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
}

export const emptyCharacterHistoryRepository: CharacterHistoryRepository = {
  readHistory: async () => ({ basics: [], scores: [], sectionChanges: [] }),
  readSnapshot: async () => null,
  readNameChangeEvents: async () => []
}
