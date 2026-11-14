import type { SeasonBackfillState, TimelineRange } from '@dfragon/database'
import type {
  SeasonBackfillTarget,
  SeasonBackfillJob
} from '../../domain/character-timeline/season-backfill.js'
import type { FetchCharacterTimeline } from './ports.js'
import { type JobQueue, createJobQueue } from './queue.js'
import type { SeasonBackfillRepository } from './repository.js'
import { splitTimelineRanges } from '../../domain/character-timeline/ranges.js'

const MINUTE_MS = 60_000
// 운영 배포 뒤 실제 요청 수와 시간을 재 다시 정할 시작값이다(#1324).
const SEASON_BACKFILL_CONCURRENCY = 2

export type SeasonBackfillQueue = JobQueue<SeasonBackfillTarget, SeasonBackfillJob>

function targetKey({ character: { serverId, characterId }, seasonId }: SeasonBackfillTarget) {
  return `${serverId}/${characterId}/${seasonId}`
}

export function createSeasonBackfillQueue(
  backfill: (job: SeasonBackfillJob) => Promise<void>,
  reportFailure: () => void
): SeasonBackfillQueue {
  return createJobQueue(targetKey, backfill, reportFailure, SEASON_BACKFILL_CONCURRENCY)
}

function backfillStart(range: TimelineRange, state: SeasonBackfillState | undefined): Date {
  if (state === undefined) {
    return range.start
  }

  return new Date(state.backfilledUntil.getTime() + MINUTE_MS)
}

export class SeasonBackfillService {
  constructor(
    private readonly repository: SeasonBackfillRepository,
    private readonly fetchTimeline: FetchCharacterTimeline
  ) {}

  // 끝까지 받은 캐릭터는 다시 부르지 않는다. 실패하면 그 자리에서 멈추고, 다음 요청이 저장한 구간 뒤부터 이어 받는다.
  async backfill({ character, seasonId, range }: SeasonBackfillJob): Promise<void> {
    const state = await this.repository.readState(character, seasonId)

    if (state?.completedAt != null) {
      return
    }

    // 구간 교체가 받은 위치를 그 구간 끝으로 덮어쓰므로 앞 구간부터 차례로 저장한다.
    for (const part of splitTimelineRanges(backfillStart(range, state), range.end)) {
      const inputs = await this.fetchTimeline(character, part)
      await this.repository.replaceRange(character, seasonId, part, inputs)
    }

    await this.repository.recordCompleted(character, seasonId)
  }
}
