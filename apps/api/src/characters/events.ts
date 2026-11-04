import type { CharacterIdentity } from './identity.js'

// 캐릭터 11개 섹션을 받았거나 캐릭터 캐시가 맞았을 때 낸다. 구독자는 던지지 않고 곧바로 돌아와야 한다.
export const CHARACTER_FETCHED = 'character.fetched'

export class CharacterFetched implements CharacterIdentity {
  constructor(
    readonly serverId: string,
    readonly characterId: string
  ) {}
}
