import type { PopulationActivity, StoredClearPopulation, TimelineRange } from '@dfragon/database'
import { addWeeks, subMinutes } from 'date-fns'
import { INACTIVE_AFTER_MS } from '@dfragon/server-core/domain/character-activity.js'
import { splitTimelineRanges } from '@dfragon/server-core/domain/character-timeline/index.js'
import { startOfResetWeek } from '@dfragon/server-core/domain/seoul-time.js'
import type { ClearContent } from '@dfragon/server-core/domain/content-clears/index.js'

type ClearCollectionWeek = {
  contentId: string
  weekStart: Date
}

export type ClearCollectionPlan = {
  ranges: TimelineRange[]
  weeks: ClearCollectionWeek[]
}

function weeksBefore(start: Date, end: Date): Date[] {
  const weeks: Date[] = []
  for (let week = start; week < end; week = addWeeks(week, 1)) {
    weeks.push(week)
  }

  return weeks
}

function contentWeeks(
  content: ClearContent,
  populations: readonly StoredClearPopulation[],
  currentWeek: Date
): Date[] {
  const closedWeeks = new Set(
    populations
      .filter(({ contentId, closed }) => contentId === content.id && closed)
      .map(({ weekStart }) => weekStart.getTime())
  )

  return weeksBefore(startOfResetWeek(content.releasedAt), currentWeek).filter(
    (week) => !closedWeeks.has(week.getTime())
  )
}

// 이어지는 주는 한 구간으로 묶어 캐릭터당 요청을 줄인다. 구간이 90일을 넘으면 Neople 한도에 맞춰 나눈다.
function toRanges(weeks: readonly ClearCollectionWeek[]): TimelineRange[] {
  const starts = [...new Set(weeks.map(({ weekStart }) => weekStart.getTime()))].sort(
    (left, right) => left - right
  )
  const runs: { start: Date; end: Date }[] = []
  for (const start of starts) {
    const run = runs.at(-1)
    const end = addWeeks(start, 1)
    if (run?.end.getTime() === start) {
      run.end = end
    } else {
      runs.push({ start: new Date(start), end })
    }
  }

  return runs.flatMap(({ start, end }) => splitTimelineRanges(start, subMinutes(end, 1)))
}

// 진행 중인 주는 집계하지 않는다. 주가 끝난 뒤 한 번 받아 바로 마감한다.
export function planClearCollection(
  contents: readonly ClearContent[],
  populations: readonly StoredClearPopulation[],
  startedAt: Date
): ClearCollectionPlan {
  const currentWeek = startOfResetWeek(startedAt)
  const weeks = contents.flatMap((content) =>
    contentWeeks(content, populations, currentWeek).map((weekStart) => ({
      contentId: content.id,
      weekStart
    }))
  )

  const ranges = toRanges(weeks)

  return { ranges, weeks }
}

// 비활성 캐릭터는 최근 30일 타임라인이 비어 있어, 그보다 오래된 구간을 받을 때만 요청한다.
export function toRequestActivity(plan: ClearCollectionPlan, startedAt: Date): PopulationActivity {
  const inactiveSince = startedAt.getTime() - INACTIVE_AFTER_MS
  if (plan.ranges.some(({ start }) => start.getTime() < inactiveSince)) {
    return 'include-inactive'
  }

  return 'active-only'
}

export const weekKey = (contentId: string, weekStart: Date) =>
  JSON.stringify([contentId, weekStart.getTime()])
