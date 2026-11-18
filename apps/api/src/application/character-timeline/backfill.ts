import type { TimelineCharacter } from '@dfragon/database'
import type { FetchCharacterTimeline } from '@dfragon/server-core/application/character-timeline/ports.js'
import type { EnhancementBackfillRepository } from './repository.js'
import { ENHANCEMENT_CODES } from '@dfragon/server-core/domain/character-timeline/project.js'
import {
  NEOPLE_TIMELINE_START,
  splitTimelineRanges
} from '@dfragon/server-core/domain/character-timeline/ranges.js'
import { TIMELINE_COLLECTION_START } from './sync.js'

// 정기 동기화가 받지 않는 중천 전의 캐릭터명 변경(102), 모험단명 변경(105)도 같은 요청으로 받는다.
export const ENHANCEMENT_BACKFILL_CODES = [102, 105, ...ENHANCEMENT_CODES]

const MINUTE_MS = 60_000
// 중천 시작부터는 정기 동기화가 모든 코드를 받으므로 그 직전 분까지만 받는다.
const BACKFILL_END = new Date(TIMELINE_COLLECTION_START.getTime() - MINUTE_MS)

function backfillStart(backfilledUntil: Date | null): Date {
  if (backfilledUntil === null) {
    return NEOPLE_TIMELINE_START
  }

  return new Date(backfilledUntil.getTime() + MINUTE_MS)
}

export class EnhancementBackfillService {
  constructor(
    private readonly repository: EnhancementBackfillRepository,
    private readonly fetchTimeline: FetchCharacterTimeline
  ) {}

  // 실패하면 그 자리에서 멈추고, 다음 백필이 저장한 구간 뒤부터 이어 받는다.
  async backfill(character: TimelineCharacter): Promise<void> {
    const backfilledUntil = await this.repository.readBackfilledUntil(character)

    // 구간 교체가 백필 위치를 그 구간 끝으로 덮어쓰므로 앞 구간부터 차례로 저장한다.
    for (const range of splitTimelineRanges(backfillStart(backfilledUntil), BACKFILL_END)) {
      const inputs = await this.fetchTimeline(character, range)
      await this.repository.replaceRange(character, range, inputs)
    }
  }
}
