import {
  type DatabaseClient,
  enqueueCollectedCharacters,
  recordCharacterBasic,
  recordCollectionFailure,
  takeCollectionBatch
} from '@dfragon/database'
import type { NeopleClient } from '@dfragon/neople'
import type { CollectionStore, FetchCharacterBasic } from './collect.js'
import type { EnqueueCharacters } from './import.js'

export function createNeopleCharacterBasic(neople: NeopleClient): FetchCharacterBasic {
  return (character) => neople.characterBasic(character)
}

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
