import type {
  ClearAdventureSize,
  ClearFameBandCount,
  ClearFirstWeekCount,
  ClearJobFameSample,
  ClearStageMoveCount,
  ClearStagePrevious,
  ClearStreakCount,
  ClearTimeCount,
  ClearWeekGroup,
  ClearWeekGroupSample,
  StoredClearPopulation
} from '@dfragon/database'
import { formatResetDate } from '../seoul-time.js'
import type { ClearStagePair } from './contents.js'
import {
  type ClearFameDistribution,
  type ClearJobStats,
  type ClearTimes,
  toClearJobs,
  toClearTimes,
  toFameDistribution
} from './samples.js'
import type { ClearContentHeader, ClearContentSummary, ClearWeek } from './stats.js'

export type ClearWeeklyClear = {
  weekStart: string
  population: number
  firstCleared: number
  repeatCleared: number
  everCleared: number
}

export type ClearWeekGroupStats = {
  cleared: number
  fame: ClearFameDistribution | null
}

export type ClearStageMoves = {
  hard: Record<ClearStagePrevious, number>
  normal: Record<ClearStagePrevious, number>
}

export type ClearContentStats = ClearContentHeader &
  ClearTimes & {
    week: ClearWeek | null
    jobs: ClearJobStats[]
    adventures: ClearAdventureSize[]
    weeklyClears: ClearWeeklyClear[]
    fameBands: ClearFameBandCount[]
    weekOverWeek: Record<ClearWeekGroup, ClearWeekGroupStats> | null
    stageMoves: ClearStageMoves | null
    streaks: ClearStreakCount[] | null
  }

// 레이드가 아니면 weekGroups, streaks가 null이고, 일반과 하드 짝이 없으면 stageMoves가 null이다.
export type ClearContentSamples = {
  jobFames: readonly ClearJobFameSample[]
  adventures: ClearAdventureSize[]
  firstWeeks: readonly ClearFirstWeekCount[]
  fameBands: ClearFameBandCount[]
  times: readonly ClearTimeCount[]
  weekGroups: readonly ClearWeekGroupSample[] | null
  stageMoves: { pair: ClearStagePair; counts: readonly ClearStageMoveCount[] } | null
  streaks: ClearStreakCount[] | null
}

// 첫 클리어는 그 주가 처음 깬 주인 캐릭터, 다시 클리어는 그 주 클리어 수의 나머지다.
// 챌린지는 클리어 수가 누적이라 다시 클리어가 그 전 주까지 깬 캐릭터 수가 된다.
function toWeeklyClears(
  weeks: readonly ClearWeek[],
  firstWeeks: readonly ClearFirstWeekCount[]
): ClearWeeklyClear[] {
  return weeks.map(({ weekStart, population, cleared }) => {
    const firstCleared = firstWeeks
      .filter((first) => formatResetDate(first.weekStart) === weekStart)
      .reduce((total, first) => total + first.characters, 0)
    const everCleared = firstWeeks
      .filter((first) => formatResetDate(first.weekStart) <= weekStart)
      .reduce((total, first) => total + first.characters, 0)
    const repeatCleared = cleared - firstCleared

    return { weekStart, population, firstCleared, repeatCleared, everCleared }
  })
}

function toWeekOverWeek(
  samples: readonly ClearWeekGroupSample[]
): Record<ClearWeekGroup, ClearWeekGroupStats> {
  const statsOf = (group: ClearWeekGroup): ClearWeekGroupStats => {
    const sample = samples.find((candidate) => candidate.group === group)

    if (sample === undefined) {
      return { cleared: 0, fame: null }
    }

    const fame = toFameDistribution(sample)

    return { cleared: sample.cleared, fame }
  }

  const both = statsOf('both')
  const returned = statsOf('returned')
  const left = statsOf('left')
  const first = statsOf('first')

  return { both, returned, left, first }
}

function toStageCounts(
  counts: readonly ClearStageMoveCount[],
  contentId: string
): Record<ClearStagePrevious, number> {
  const countOf = (previous: ClearStagePrevious) =>
    counts
      .filter((count) => count.contentId === contentId && count.previous === previous)
      .reduce((total, count) => total + count.characters, 0)

  const same = countOf('same')
  const other = countOf('other')
  const none = countOf('none')

  return { same, other, none }
}

function toStageMoves({
  pair,
  counts
}: NonNullable<ClearContentSamples['stageMoves']>): ClearStageMoves {
  const hard = toStageCounts(counts, pair.hard.id)
  const normal = toStageCounts(counts, pair.normal.id)

  return { hard, normal }
}

export function toEmptyContentStats({
  weeks: _weeks,
  ...header
}: ClearContentSummary): ClearContentStats {
  return {
    ...header,
    week: null,
    jobs: [],
    adventures: [],
    weeklyClears: [],
    fameBands: [],
    weekOverWeek: null,
    stageMoves: null,
    streaks: null,
    weekdays: [],
    hours: []
  }
}

export function toClearContentStats(
  { weeks, ...header }: ClearContentSummary,
  population: StoredClearPopulation,
  samples: ClearContentSamples
): ClearContentStats {
  const weekStart = formatResetDate(population.weekStart)
  const week = weeks.find((summaryWeek) => summaryWeek.weekStart === weekStart) ?? null
  const jobs = toClearJobs(population, samples.jobFames)
  const weeklyClears = toWeeklyClears(weeks, samples.firstWeeks)
  const weekOverWeek = samples.weekGroups !== null ? toWeekOverWeek(samples.weekGroups) : null
  const stageMoves = samples.stageMoves !== null ? toStageMoves(samples.stageMoves) : null
  const times = toClearTimes(samples.times)

  return {
    ...header,
    week,
    jobs,
    adventures: samples.adventures,
    weeklyClears,
    fameBands: samples.fameBands,
    weekOverWeek,
    stageMoves,
    streaks: samples.streaks,
    ...times
  }
}
