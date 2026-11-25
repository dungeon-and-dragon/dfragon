import {
  type CharacterBasicInput,
  type CollectedCharacter,
  type DatabaseClient,
  type FameRefreshTarget,
  countFameRefreshTargets,
  countInactiveCharacters,
  readFameRefreshTargets,
  readInactiveCharacters,
  recordCharacterActive,
  recordCharacterBasic,
  recordCharacterInactive
} from '@dfragon/database'
import PQueue from 'p-queue'
import type { CharacterActivityRepository } from '#application/character-activity/repository.js'

// 명성 갱신은 Neople 동시 요청 수만큼(2026-11-24 운영 약 600명) 캐릭터를 함께 처리한다. 저장을 전용 pool 크기만큼만
// 함께 보내 기본 정보 저장 transaction이 연결을 기다리다 Prisma의 시작 대기 2초를 넘겨 P2028로 job을 끝내지 않게 한다.
export const CHARACTER_ACTIVITY_POOL = { maxConnections: 8 }

export class DatabaseCharacterActivityRepository implements CharacterActivityRepository {
  private readonly writes = new PQueue({ concurrency: CHARACTER_ACTIVITY_POOL.maxConnections })

  constructor(private readonly client: DatabaseClient) {}

  countRefreshTargets(): Promise<number> {
    return countFameRefreshTargets(this.client)
  }

  readRefreshTargets(
    after: CollectedCharacter | null,
    limit: number
  ): Promise<FameRefreshTarget[]> {
    return readFameRefreshTargets(this.client, after, limit)
  }

  countInactive(): Promise<number> {
    return countInactiveCharacters(this.client)
  }

  readInactive(after: CollectedCharacter | null, limit: number): Promise<CollectedCharacter[]> {
    return readInactiveCharacters(this.client, after, limit)
  }

  recordActive(character: CollectedCharacter, lastActiveAt: Date): Promise<void> {
    return this.writes.add(() => recordCharacterActive(this.client, character, lastActiveAt))
  }

  recordInactive(character: CollectedCharacter, inactiveSince: Date): Promise<void> {
    return this.writes.add(() => recordCharacterInactive(this.client, character, inactiveSince))
  }

  recordBasic(basic: CharacterBasicInput): Promise<void> {
    return this.writes.add(() => recordCharacterBasic(this.client, basic))
  }
}
