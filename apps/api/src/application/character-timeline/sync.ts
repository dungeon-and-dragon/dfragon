import type { TimelineCharacter, TimelineSyncState } from '@dfragon/database'
import {
  TimelineFailure,
  type TimelineFailureKind
} from '../../domain/character-timeline/failure.js'
import type { FetchCharacterTimeline } from './ports.js'
import type { TimelineSyncRepository } from './repository.js'
import { splitTimelineRanges } from '../../domain/character-timeline/ranges.js'

// 중천 시즌 시작이다. 그 전 이력은 받지 않는다(#1175).
export const TIMELINE_COLLECTION_START = new Date('2025-01-09T06:00:00+09:00')
const RESYNC_INTERVAL_MS = 60 * 60 * 1000
// Neople 타임라인은 행동 뒤 보통 10분 안에 나타나지만 더 늦을 때가 있어 넉넉히 30분을 다시 받는다(#1187).
const RECORD_DELAY_MS = 30 * 60 * 1000

export type TimelineSyncFailure = `neople-${TimelineFailureKind}` | 'database'

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
    Math.max(syncedUntil.getTime() - RECORD_DELAY_MS, TIMELINE_COLLECTION_START.getTime())
  )
}

function syncedRecently(state: TimelineSyncState | undefined, now: Date): boolean {
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
    private readonly now: () => Date = () => new Date()
  ) {}

  async sync(character: TimelineCharacter): Promise<void> {
    try {
      const state = await this.repository.readSyncState(character)
      const until = this.now()

      if (syncedRecently(state, until)) {
        return
      }

      // 구간 교체가 synced_until을 그 구간 끝으로 덮어쓰므로 앞 구간부터 차례로 저장한다.
      for (const range of splitTimelineRanges(syncStart(state), until)) {
        const inputs = await this.fetchTimeline(character, range)
        await this.repository.replaceRange(character, range, inputs)
      }

      await this.repository.recordSuccess(character)
    } catch (error) {
      await this.repository.recordFailure(character, syncFailureOf(error))
    }
  }
}
