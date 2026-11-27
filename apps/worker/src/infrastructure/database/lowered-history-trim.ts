import {
  type CharacterHistoryKey,
  type DatabaseClient,
  readLoweredHistoryCharacters,
  trimLoweredCharacterHistory
} from '@dfragon/database'
import type { LoweredHistoryTrimRepository } from '#application/character-history/repository.js'

export class DatabaseLoweredHistoryTrimRepository implements LoweredHistoryTrimRepository {
  constructor(private readonly client: DatabaseClient) {}

  readCharacters(): Promise<CharacterHistoryKey[]> {
    return readLoweredHistoryCharacters(this.client)
  }

  trim(character: CharacterHistoryKey): Promise<boolean> {
    return trimLoweredCharacterHistory(this.client, character)
  }
}
