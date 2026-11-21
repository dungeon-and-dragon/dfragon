import { type NeopleClient, NeopleRequestFailure } from '@dfragon/neople'
import pThrottle from 'p-throttle'
import type { FetchCharacterBasic } from '#application/character-collection/ports.js'
import { CharacterCollectionFailure } from '#domain/character-collection/index.js'

export type WorkerNeople = Pick<
  NeopleClient,
  | 'character'
  | 'characterBasic'
  | 'characterSkillStyle'
  | 'characterTimeline'
  | 'charactersFame'
  | 'jobs'
  | 'multiItems'
  | 'servers'
>

// 새 캐릭터 찾기와 저장, 클리어, 스킬 스타일 수집이 같은 Neople 요청 속도 상한을 나눠 쓴다. 기다리는 호출은 부른 순서대로 나가 한쪽이 계속 밀리지 않는다.
export function paceNeopleRequests(neople: WorkerNeople, requestsPerSecond: number): WorkerNeople {
  const throttle = pThrottle({ limit: 1, interval: 1000 / requestsPerSecond })
  const character = throttle(neople.character)
  const characterBasic = throttle(neople.characterBasic)
  const characterSkillStyle = throttle(neople.characterSkillStyle)
  const characterTimeline = throttle(neople.characterTimeline)
  const charactersFame = throttle(neople.charactersFame)
  const jobs = throttle(neople.jobs)
  const multiItems = throttle(neople.multiItems)
  const servers = throttle(neople.servers)

  return {
    character,
    characterBasic,
    characterSkillStyle,
    characterTimeline,
    charactersFame,
    jobs,
    multiItems,
    servers
  }
}

export function createNeopleCharacterBasic(
  neople: Pick<NeopleClient, 'characterBasic'>
): FetchCharacterBasic {
  return async (character) => {
    try {
      return await neople.characterBasic(character)
    } catch (error) {
      if (error instanceof NeopleRequestFailure) {
        throw new CharacterCollectionFailure(error.kind)
      }
      throw error
    }
  }
}
