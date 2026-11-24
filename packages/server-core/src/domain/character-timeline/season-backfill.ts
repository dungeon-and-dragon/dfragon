import type { StoredSeason, TimelineCharacter, TimelineRange } from '@dfragon/database'
import { NEOPLE_TIMELINE_START } from './ranges.js'

const MINUTE_MS = 60_000

export type SeasonBackfillTarget = {
  character: TimelineCharacter
  seasonId: number
}

export type SeasonBackfillJob = SeasonBackfillTarget & { range: TimelineRange }

export function toSeasonTimelineStart(startsAt: Date): Date {
  const start = Math.max(startsAt.getTime(), NEOPLE_TIMELINE_START.getTime())

  return new Date(start)
}

// 끝은 다음 시즌 시작 직전 분이다. 구간은 양 끝을 포함해, 다음 시즌 시작 분까지 넣으면 그 분의 정기 동기화 행까지 바꾼다.
export function toSeasonBackfillRange(startsAt: Date, nextStartsAt: Date): TimelineRange {
  const start = toSeasonTimelineStart(startsAt)
  const end = new Date(nextStartsAt.getTime() - MINUTE_MS)

  return { start, end }
}

export function findSeasonBackfillRange(
  seasons: readonly Pick<StoredSeason, 'id' | 'startsAt'>[],
  seasonId: number
): TimelineRange | undefined {
  const ordered = seasons.toSorted(
    (left, right) => left.startsAt.getTime() - right.startsAt.getTime()
  )
  const index = ordered.findIndex(({ id }) => id === seasonId)
  const season = ordered[index]
  const next = ordered[index + 1]

  if (season === undefined || next === undefined) {
    return undefined
  }

  return toSeasonBackfillRange(season.startsAt, next.startsAt)
}
