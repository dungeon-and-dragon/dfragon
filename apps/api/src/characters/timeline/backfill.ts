import type { TimelineCharacter, TimelineItemInput, TimelineRange } from '@dfragon/database'
import type { FetchCharacterTimeline } from './neople.js'
import { splitTimelineRanges } from './ranges.js'
import { TIMELINE_COLLECTION_START } from './sync.js'

const MINUTE_MS = 60_000
// Neople 타임라인은 2017-09-21 이후 데이터만 준다(#1175 API 제약).
const BACKFILL_START = new Date('2017-09-21T00:00:00+09:00')
// 중천 시작부터는 정기 동기화가 모든 코드를 받으므로 그 직전 분까지만 받는다.
const BACKFILL_END = new Date(TIMELINE_COLLECTION_START.getTime() - MINUTE_MS)

export interface EnhancementBackfillStore {
  readBackfilledUntil(character: TimelineCharacter): Promise<Date | null>
  replaceRange(
    character: TimelineCharacter,
    range: TimelineRange,
    items: readonly TimelineItemInput[]
  ): Promise<void>
}

export interface EnhancementBackfillDependencies {
  fetchTimeline: FetchCharacterTimeline
  store: EnhancementBackfillStore
}

function backfillStart(backfilledUntil: Date | null): Date {
  if (backfilledUntil === null) {
    return BACKFILL_START
  }

  return new Date(backfilledUntil.getTime() + MINUTE_MS)
}

// 실패하면 그 자리에서 멈추고, 다음 백필이 저장한 구간 뒤부터 이어 받는다.
export async function backfillEnhancements(
  character: TimelineCharacter,
  { fetchTimeline, store }: EnhancementBackfillDependencies
): Promise<void> {
  const backfilledUntil = await store.readBackfilledUntil(character)
  // 구간 교체가 백필 위치를 그 구간 끝으로 덮어쓰므로 앞 구간부터 차례로 저장한다.
  for (const range of splitTimelineRanges(backfillStart(backfilledUntil), BACKFILL_END)) {
    const { items } = await fetchTimeline(character, range)
    await store.replaceRange(character, range, items)
  }
}
