import type { EventEmitter2 } from '@nestjs/event-emitter'
import type { CharacterIdentity } from './identity.js'

export const CHARACTER_FETCHED = 'character.fetched'

export class CharacterFetched implements CharacterIdentity {
  constructor(
    readonly serverId: string,
    readonly characterId: string,
    // Neople 기본 정보 섹션 응답 그대로다. 상세 조회는 이 섹션을 검증하지 않으므로 쓰는 구독자가 검증한다.
    readonly basic: Readonly<Record<string, unknown>>
  ) {}
}

// 캐릭터 이벤트는 이 class로만 낸다. 메서드의 참조를 찾으면 발행하는 곳이 모두 나온다.
export class CharacterEvents {
  constructor(private readonly emitter: EventEmitter2) {}

  // 캐릭터 11개 섹션을 받았거나 캐릭터 캐시가 맞았을 때 부른다. 구독자는 던지지 않고 곧바로 돌아와야 한다.
  fetched(
    { serverId, characterId }: CharacterIdentity,
    basic: Readonly<Record<string, unknown>>
  ): void {
    this.emitter.emit(CHARACTER_FETCHED, new CharacterFetched(serverId, characterId, basic))
  }
}
