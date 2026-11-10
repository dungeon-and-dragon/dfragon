import {
  type DatabaseClient,
  enqueueCollectedCharacters,
  recordCharacterBasic,
  recordCollectionFailure,
  takeCollectionBatch
} from '@dfragon/database'
import type { NeopleClient } from '@dfragon/neople'
import pThrottle from 'p-throttle'
import type { CollectionStore, FetchCharacterBasic } from './collect.js'
import type { EnqueueCharacters } from './import.js'

export type WorkerNeople = Pick<
  NeopleClient,
  'characterBasic' | 'characterSkillStyle' | 'characterTimeline'
>

// 새 캐릭터 저장과 클리어, 스킬 스타일 수집이 Neople 요청 속도 상한 하나를 나눠 쓴다. 기다리는 호출은 부른 순서대로 나가 한쪽이 계속 밀리지 않는다.
export function paceNeopleRequests(neople: WorkerNeople, requestsPerSecond: number): WorkerNeople {
  const throttle = pThrottle({ limit: 1, interval: 1000 / requestsPerSecond })

  return {
    characterBasic: throttle(neople.characterBasic),
    characterSkillStyle: throttle(neople.characterSkillStyle),
    characterTimeline: throttle(neople.characterTimeline)
  }
}

export function createNeopleCharacterBasic(
  neople: Pick<NeopleClient, 'characterBasic'>
): FetchCharacterBasic {
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
