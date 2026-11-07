import type { SeasonBackfillState, TimelineCharacter, TimelineRange } from '@dfragon/database'
import type { FetchCharacterTimeline } from './neople.js'
import { type JobQueue, createJobQueue } from './queue.js'
import { NEOPLE_TIMELINE_START, splitTimelineRanges } from './ranges.js'
import type { TimelineInputs } from './rows.js'

const MINUTE_MS = 60_000
// 운영 배포 뒤 실제 요청 수와 시간을 재 다시 정할 시작값이다(#1324).
const SEASON_BACKFILL_CONCURRENCY = 2

export type SeasonBackfillTarget = {
  character: TimelineCharacter
  seasonId: number
}

export type SeasonBackfillJob = SeasonBackfillTarget & { range: TimelineRange }

export type SeasonBackfillQueue = JobQueue<SeasonBackfillTarget, SeasonBackfillJob>

export type SeasonBackfillProgress = {
  done: number
  total: number
}

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

export function toSeasonTimelineStart(startsAt: Date): Date {
  return new Date(Math.max(startsAt.getTime(), NEOPLE_TIMELINE_START.getTime()))
}

// 끝은 다음 시즌 시작 직전 분이다. 구간은 양 끝을 포함해, 다음 시즌 시작 분까지 넣으면 그 분의 정기 동기화 행까지 바꾼다.
export function toSeasonBackfillRange(startsAt: Date, nextStartsAt: Date): TimelineRange {
  const start = toSeasonTimelineStart(startsAt)
  const end = new Date(nextStartsAt.getTime() - MINUTE_MS)

  return { start, end }
}

// 받기는 앞 구간부터 저장하고 받은 위치를 그 구간 끝으로 옮기므로, 위치까지 끝난 구간을 받은 구간으로 센다.
export function toSeasonBackfillProgress(
  range: TimelineRange,
  characterCount: number,
  states: readonly SeasonBackfillState[]
): SeasonBackfillProgress {
  const ranges = splitTimelineRanges(range.start, range.end)
  const done = states
    .map(({ backfilledUntil }) => ranges.filter(({ end }) => end <= backfilledUntil).length)
    .reduce((sum, count) => sum + count, 0)
  const total = ranges.length * characterCount

  return { done, total }
}

export function isSeasonBackfilled({ done, total }: SeasonBackfillProgress): boolean {
  return total > 0 && done === total
}

export function toSeasonBackfillJobs(
  characters: readonly TimelineCharacter[],
  seasonId: number,
  range: TimelineRange,
  states: readonly SeasonBackfillState[]
): SeasonBackfillJob[] {
  const completed = new Set(
    states
      .filter(({ completedAt }) => completedAt !== null)
      .map(({ serverId, characterId }) => `${serverId}/${characterId}`)
  )

  return characters
    .filter(({ serverId, characterId }) => !completed.has(`${serverId}/${characterId}`))
    .map(({ serverId, characterId }) => ({ character: { serverId, characterId }, seasonId, range }))
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
