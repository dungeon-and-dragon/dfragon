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

// 종료 때도 진행 중인 요청 하나는 끝까지 받는다. 중간에 끊으면 캐릭터 실패로 기록될 수 있다.
const unaborted = new AbortController().signal

export function createNeopleCharacterBasic(neople: NeopleClient): FetchCharacterBasic {
  return async (character) => {
    const basic = await neople.characterBasic(character, unaborted)
    const fame = basic.fame ?? null
    const guildId = basic.guildId ?? null
    const guildName = basic.guildName ?? null

    return { ...basic, fame, guildId, guildName }
  }
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
