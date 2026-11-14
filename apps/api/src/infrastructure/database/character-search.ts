import {
  type DatabaseClient,
  type StoredAdventureName,
  readAdventureNames
} from '@dfragon/database'
import type { CharacterSearchRepository } from '../../application/character-search/repository.js'

export class DatabaseCharacterSearchRepository implements CharacterSearchRepository {
  constructor(private readonly client: DatabaseClient) {}

  readAdventureNames(
    characters: readonly { serverId: string; characterId: string }[]
  ): Promise<StoredAdventureName[]> {
    return readAdventureNames(this.client, characters)
  }
}
