import { type NeopleClient, NeopleRequestFailure } from '@dfragon/neople'
import pThrottle from 'p-throttle'
import type { FetchCharacterBasic } from '../../application/character-collection/ports.js'
import { CharacterCollectionFailure } from '../../domain/character-collection/failure.js'

export type WorkerNeople = Pick<
  NeopleClient,
  'character' | 'characterBasic' | 'characterSkillStyle' | 'characterTimeline' | 'multiItems'
>

// 새 캐릭터 저장과 클리어, 스킬 스타일 수집이 key 하나의 Neople 요청 속도 상한을 나눠 쓴다. 기다리는 호출은 부른 순서대로 나가 한쪽이 계속 밀리지 않는다.
export function paceNeopleRequests(neople: WorkerNeople, requestsPerSecond: number): WorkerNeople {
  const throttle = pThrottle({ limit: 1, interval: 1000 / requestsPerSecond })
  const character = throttle(neople.character)
  const characterBasic = throttle(neople.characterBasic)
  const characterSkillStyle = throttle(neople.characterSkillStyle)
  const characterTimeline = throttle(neople.characterTimeline)
  const multiItems = throttle(neople.multiItems)

  return { character, characterBasic, characterSkillStyle, characterTimeline, multiItems }
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
