import {
  type DatabaseClient,
  type StoredAdventureName,
  type StoredCharacterScoreRow,
  readAdventureNames,
  readCharacterScores
} from '@dfragon/database'
import type { CharacterSearchRepository } from '#application/character-search/repository.js'

export class DatabaseCharacterSearchRepository implements CharacterSearchRepository {
  constructor(private readonly client: DatabaseClient) {}

  readAdventureNames(
    characters: readonly { serverId: string; characterId: string }[]
  ): Promise<StoredAdventureName[]> {
    return readAdventureNames(this.client, characters)
  }

  readCharacterScores(
    characters: readonly { serverId: string; characterId: string }[]
  ): Promise<StoredCharacterScoreRow[]> {
    return readCharacterScores(this.client, characters)
  }
}
