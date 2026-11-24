import type { SeasonBackfillState, TimelineCharacter, TimelineRange } from '@dfragon/database'
import {
  type SeasonBackfillJob,
  splitTimelineRanges
} from '@dfragon/server-core/domain/character-timeline/index.js'

export type SeasonBackfillProgress = {
  done: number
  total: number
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
