import {
  type CharacterBasicInput,
  type CollectedCharacter,
  type DatabaseClient,
  enqueueCollectedCharacters,
  recordCharacterBasic,
  recordCollectionFailure,
  takeCollectionBatch
} from '@dfragon/database'
import type {
  CollectionFailure,
  CollectionRepository
} from '../../application/character-collection/repository.js'

export class DatabaseCollectionRepository implements CollectionRepository {
  constructor(private readonly client: DatabaseClient) {}

  takeBatch(limit: number): Promise<CollectedCharacter[]> {
    return takeCollectionBatch(this.client, limit)
  }

  recordBasic(basic: CharacterBasicInput): Promise<void> {
    return recordCharacterBasic(this.client, basic)
  }

  recordFailure(character: CollectedCharacter, failure: CollectionFailure): Promise<void> {
    return recordCollectionFailure(this.client, character, failure)
  }

  enqueue(characters: readonly CollectedCharacter[]): Promise<void> {
    return enqueueCollectedCharacters(this.client, characters)
  }
}
