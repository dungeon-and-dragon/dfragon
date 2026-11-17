import {
  type DatabaseClient,
  type StoredCharacterHistory,
  type StoredCharacterHistorySnapshot,
  type TimelineEventRow,
  readCharacterHistory,
  readCharacterHistorySnapshot,
  readTimelineEvents
} from '@dfragon/database'
import type { CharacterHistoryRepository } from '../../application/character-history/repository.js'
import { CHARACTER_NAME_CHANGE_CODES } from '../../domain/character-history/project.js'
import type { CharacterIdentity } from '../../domain/character-identity.js'

const nameChangeCodes = Object.values(CHARACTER_NAME_CHANGE_CODES)
const everySync = new Date(0)

export class DatabaseCharacterHistoryRepository implements CharacterHistoryRepository {
  constructor(private readonly client: DatabaseClient) {}

  readHistory(character: CharacterIdentity): Promise<StoredCharacterHistory> {
    return readCharacterHistory(this.client, character)
  }

  readSnapshot(
    character: CharacterIdentity,
    at: Date
  ): Promise<StoredCharacterHistorySnapshot | null> {
    return readCharacterHistorySnapshot(this.client, character, at)
  }

  readNameChangeEvents(character: CharacterIdentity): Promise<TimelineEventRow[]> {
    return readTimelineEvents(this.client, character, nameChangeCodes, everySync)
  }
}
