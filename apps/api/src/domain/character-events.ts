import type { CharacterIdentity } from './character-identity.js'

export class CharacterFetched implements CharacterIdentity {
  constructor(
    readonly serverId: string,
    readonly characterId: string,
    // Neople 기본 정보, 스킬 스타일 섹션 응답 그대로다. 상세 조회는 이 섹션을 검증하지 않으므로 쓰는 구독자가 검증한다.
    readonly basic: Readonly<Record<string, unknown>>,
    readonly skillStyle: Readonly<Record<string, unknown>>,
    // 캐시가 맞았을 때는 지금이 아니라 그 섹션을 Neople에서 받은 시각이다.
    readonly fetchedAt: Date
  ) {}
}
