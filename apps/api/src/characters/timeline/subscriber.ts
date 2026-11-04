import type { OnApplicationShutdown } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { CHARACTER_FETCHED, type CharacterFetched } from '../events.js'
import type { TimelineSyncQueue } from './queue.js'

export class TimelineSyncSubscriber implements OnApplicationShutdown {
  constructor(
    private readonly queue: TimelineSyncQueue,
    private readonly closeStore: () => Promise<void>
  ) {}

  @OnEvent(CHARACTER_FETCHED)
  onCharacterFetched({ serverId, characterId }: CharacterFetched): void {
    this.queue.request({ serverId, characterId })
  }

  onApplicationShutdown(): Promise<void> {
    // Prisma는 닫은 뒤에도 다음 query에서 다시 연결하므로, 대기열이 남으면 종료 뒤에도 계속 꺼내 받는다.
    this.queue.close()

    return this.closeStore()
  }
}
