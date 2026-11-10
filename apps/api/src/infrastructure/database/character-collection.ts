import {
  type DatabaseClient,
  enqueueCollectedCharacters,
  recordCharacterBasic,
  recordCollectionFailure,
  takeCollectionBatch
} from '@dfragon/database'
import type {
  CollectionStore,
  EnqueueCharacters
} from '../../application/character-collection/ports.js'

export function createDatabaseCollectionStore(client: DatabaseClient): CollectionStore {
  return {
    takeBatch: (limit) => takeCollectionBatch(client, limit),
    recordBasic: (basic) => recordCharacterBasic(client, basic),
    recordFailure: (character, failure) => recordCollectionFailure(client, character, failure)
  }
}

export function createDatabaseEnqueue(client: DatabaseClient): EnqueueCharacters {
  return (characters) => enqueueCollectedCharacters(client, characters)
}
