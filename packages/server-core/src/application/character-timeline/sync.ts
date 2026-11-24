import type { TimelineCharacter, TimelineItemInput, TimelineSyncState } from '@dfragon/database'
import type { ItemDictionaryService } from '#application/item-dictionary/index.js'
import { isRecentlyActive } from '#domain/character-activity.js'
import {
  TIMELINE_RECORD_DELAY_MS,
  TimelineFailure,
  type TimelineSyncFailure,
  type TimelineInputs,
  splitTimelineRanges
} from '#domain/character-timeline/index.js'
import { dictionaryItemIds } from '#domain/item-dictionary/index.js'
import type { FetchCharacterTimeline } from './ports.js'
import type { TimelineSyncRepository } from './repository.js'

// 중천 시즌 시작이다. 그 전 이력은 받지 않는다(#1175).
export const TIMELINE_COLLECTION_START = new Date('2025-01-09T06:00:00+09:00')
const RESYNC_INTERVAL_MS = 60 * 60 * 1000

function syncFailureOf(error: unknown): TimelineSyncFailure {
  if (error instanceof TimelineFailure) {
    return `neople-${error.kind}`
  }

  return 'database'
}

function syncStart(state: TimelineSyncState | undefined): Date {
  const syncedUntil = state?.syncedUntil
  if (syncedUntil == null) {
    return TIMELINE_COLLECTION_START
  }

  return new Date(
    Math.max(syncedUntil.getTime() - TIMELINE_RECORD_DELAY_MS, TIMELINE_COLLECTION_START.getTime())
  )
}

function latestOccurredAt({ events, items }: TimelineInputs): Date | undefined {
  const times = [...events, ...items].map((row) => row.occurredAt.getTime())

  if (times.length === 0) {
    return undefined
  }

  return new Date(Math.max(...times))
}

// 1시간 안에 성공했으면 동기화는 Neople을 부르지 않고 끝나, 요청을 넣는 쪽도 이 판정으로 요청하지 않는다.
export function isSyncedRecently(
  state: Pick<TimelineSyncState, 'lastSucceededAt'> | undefined,
  now: Date
): boolean {
  const lastSucceededAt = state?.lastSucceededAt
  if (lastSucceededAt == null) {
    return false
  }

  return now.getTime() - lastSucceededAt.getTime() < RESYNC_INTERVAL_MS
}

export class TimelineSyncService {
  constructor(
    private readonly repository: TimelineSyncRepository,
    private readonly fetchTimeline: FetchCharacterTimeline,
    private readonly itemDictionary: Pick<ItemDictionaryService, 'fill'>,
    private readonly now: () => Date = () => new Date()
  ) {}

  async sync(character: TimelineCharacter, reportItemDictionaryFailure: () => void): Promise<void> {
    const savedItems: TimelineItemInput[] = []

    try {
      const state = await this.repository.readSyncState(character)
      const until = this.now()

      if (isSyncedRecently(state, until)) {
        return
      }

      let lastActiveAt: Date | undefined

      // 구간 교체가 synced_until을 그 구간 끝으로 덮어쓰므로 앞 구간부터 차례로 저장한다.
      for (const range of splitTimelineRanges(syncStart(state), until)) {
        const inputs = await this.fetchTimeline(character, range)
        await this.repository.replaceRange(character, range, inputs)
        savedItems.push(...inputs.items)
        lastActiveAt = latestOccurredAt(inputs) ?? lastActiveAt
      }

      if (lastActiveAt !== undefined && isRecentlyActive(lastActiveAt, until)) {
        await this.repository.recordActive(character, lastActiveAt)
      }

      await this.repository.recordSuccess(character)
    } catch (error) {
      await this.repository.recordFailure(character, syncFailureOf(error))
    }

    // 사전은 동기화 결과에 들지 않아, 채우지 못해도 동기화 기록을 바꾸지 않고 다음에 그 아이템을 저장할 때 다시 채운다.
    try {
      await this.itemDictionary.fill(dictionaryItemIds(savedItems))
    } catch {
      reportItemDictionaryFailure()
    }
  }
}
