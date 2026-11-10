import type { SeasonBackfillState, TimelineCharacter, TimelineRange } from '@dfragon/database'
import type {
  SeasonBackfillTarget,
  SeasonBackfillJob
} from '../../domain/character-timeline/season-backfill.js'
import type { FetchCharacterTimeline } from './ports.js'
import { type JobQueue, createJobQueue } from './queue.js'
import { splitTimelineRanges } from '../../domain/character-timeline/ranges.js'
import type { TimelineInputs } from '../../domain/character-timeline/rows.js'

const MINUTE_MS = 60_000
// 운영 배포 뒤 실제 요청 수와 시간을 재 다시 정할 시작값이다(#1324).
const SEASON_BACKFILL_CONCURRENCY = 2

export type SeasonBackfillQueue = JobQueue<SeasonBackfillTarget, SeasonBackfillJob>

export interface SeasonBackfillStore {
  readState(
    character: TimelineCharacter,
    seasonId: number
  ): Promise<SeasonBackfillState | undefined>
  replaceRange(
    character: TimelineCharacter,
    seasonId: number,
    range: TimelineRange,
    inputs: TimelineInputs
  ): Promise<void>
  recordCompleted(character: TimelineCharacter, seasonId: number): Promise<void>
}

export interface SeasonBackfillDependencies {
  fetchTimeline: FetchCharacterTimeline
  store: SeasonBackfillStore
}

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

// 끝까지 받은 캐릭터는 다시 부르지 않는다. 실패하면 그 자리에서 멈추고, 다음 요청이 저장한 구간 뒤부터 이어 받는다.
export async function backfillSeason(
  { character, seasonId, range }: SeasonBackfillJob,
  { fetchTimeline, store }: SeasonBackfillDependencies
): Promise<void> {
  const state = await store.readState(character, seasonId)
  if (state?.completedAt != null) {
    return
  }

  // 구간 교체가 받은 위치를 그 구간 끝으로 덮어쓰므로 앞 구간부터 차례로 저장한다.
  for (const part of splitTimelineRanges(backfillStart(range, state), range.end)) {
    const inputs = await fetchTimeline(character, part)
    await store.replaceRange(character, seasonId, part, inputs)
  }
  await store.recordCompleted(character, seasonId)
}
