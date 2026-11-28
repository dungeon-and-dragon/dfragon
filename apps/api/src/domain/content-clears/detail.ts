import type {
  CharacterScoreKind,
  ClearAdventureSize,
  ClearFameBandCount,
  ClearFirstWeekCount,
  ClearJobFameSample,
  ClearJobScoreSample,
  ClearScoreBandCount,
  ClearStreakCount,
  ClearTimeCount,
  ClearWeekGroup,
  ClearWeekGroupSample,
  ClearWeekGroupScoreSample,
  ClearWeekMoveCount,
  ClearWeekMoveFrom,
  ClearWeekMoveTo,
  StoredClearPopulation
} from '@dfragon/database'
import { formatResetDate } from '@dfragon/server-core/domain/seoul-time.js'
import {
  type ClearFameDistribution,
  type ClearJobStats,
  type ClearScoreDistributions,
  type ClearTimes,
  toClearJobs,
  toClearTimes,
  toFameDistribution,
  toScoreDistributions
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
  scores: ClearScoreDistributions
}

export type ClearScoreBand = Omit<ClearScoreBandCount, 'kind'>

export type ClearContentStats = ClearContentHeader &
  ClearTimes & {
    week: ClearWeek | null
    jobs: ClearJobStats[]
    adventures: ClearAdventureSize[]
    weeklyClears: ClearWeeklyClear[]
    fameBands: ClearFameBandCount[]
    weekOverWeek: Record<ClearWeekGroup, ClearWeekGroupStats> | null
    weekMoves: ClearWeekMoveCount[] | null
    streaks: ClearStreakCount[] | null
    scoreBands: Record<CharacterScoreKind, ClearScoreBand[]>
    scoreBandMinPopulation: number
  }

// 레이드가 아니면 weekGroups, weekGroupScores, streaks가 null이고, 일반과 하드 짝이 없으면 weekMoves가 null이다.
export type ClearContentSamples = {
  jobFames: readonly ClearJobFameSample[]
  jobScores: readonly ClearJobScoreSample[]
  scoreBands: readonly ClearScoreBandCount[]
  weekGroupScores: readonly ClearWeekGroupScoreSample[] | null
  adventures: ClearAdventureSize[]
  firstWeeks: readonly ClearFirstWeekCount[]
  fameBands: ClearFameBandCount[]
  times: readonly ClearTimeCount[]
  weekGroups: readonly ClearWeekGroupSample[] | null
  weekMoves: readonly ClearWeekMoveCount[] | null
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
  samples: readonly ClearWeekGroupSample[],
  scoreSamples: readonly ClearWeekGroupScoreSample[]
): Record<ClearWeekGroup, ClearWeekGroupStats> {
  const statsOf = (group: ClearWeekGroup): ClearWeekGroupStats => {
    const sample = samples.find((candidate) => candidate.group === group)
    const scores = toScoreDistributions(scoreSamples.filter((score) => score.group === group))

    if (sample === undefined) {
      return { cleared: 0, fame: null, scores }
    }

    const fame = toFameDistribution(sample)

    return { cleared: sample.cleared, fame, scores }
  }

  const both = statsOf('both')
  const returned = statsOf('returned')
  const left = statsOf('left')
  const first = statsOf('first')

  return { both, returned, left, first }
}

const WEEK_MOVE_FROM_ORDER: readonly ClearWeekMoveFrom[] = [
  'hard',
  'normal',
  'matching',
  'returned',
  'first'
]
const WEEK_MOVE_TO_ORDER: readonly ClearWeekMoveTo[] = ['hard', 'normal', 'matching', 'left']

function toWeekMoves(counts: readonly ClearWeekMoveCount[]): ClearWeekMoveCount[] {
  return counts.toSorted((left, right) => {
    const fromOrder =
      WEEK_MOVE_FROM_ORDER.indexOf(left.from) - WEEK_MOVE_FROM_ORDER.indexOf(right.from)

    if (fromOrder !== 0) {
      return fromOrder
    }

    return WEEK_MOVE_TO_ORDER.indexOf(left.to) - WEEK_MOVE_TO_ORDER.indexOf(right.to)
  })
}

function toScoreBands(
  rows: readonly ClearScoreBandCount[]
): Record<CharacterScoreKind, ClearScoreBand[]> {
  const bandsOf = (kind: CharacterScoreKind) =>
    rows
      .filter((row) => row.kind === kind)
      .map(({ score, population, cleared }) => ({ score, population, cleared }))

  const equipment = bandsOf('equipment')
  const buff = bandsOf('buff')

  return { equipment, buff }
}

export function toEmptyContentStats(
  { weeks: _weeks, ...header }: ClearContentSummary,
  scoreBandMinPopulation: number
): ClearContentStats {
  return {
    ...header,
    week: null,
    jobs: [],
    adventures: [],
    weeklyClears: [],
    fameBands: [],
    weekOverWeek: null,
    weekMoves: null,
    streaks: null,
    scoreBands: { equipment: [], buff: [] },
    scoreBandMinPopulation,
    weekdays: [],
    hours: []
  }
}

export function toClearContentStats(
  { weeks, ...header }: ClearContentSummary,
  population: StoredClearPopulation,
  samples: ClearContentSamples,
  scoreBandMinPopulation: number
): ClearContentStats {
  const weekStart = formatResetDate(population.weekStart)
  const week = weeks.find((summaryWeek) => summaryWeek.weekStart === weekStart) ?? null
  const jobs = toClearJobs(population, samples.jobFames, samples.jobScores)
  const weeklyClears = toWeeklyClears(weeks, samples.firstWeeks)
  const weekOverWeek =
    samples.weekGroups !== null
      ? toWeekOverWeek(samples.weekGroups, samples.weekGroupScores ?? [])
      : null
  const weekMoves = samples.weekMoves !== null ? toWeekMoves(samples.weekMoves) : null
  const times = toClearTimes(samples.times)
  const scoreBands = toScoreBands(samples.scoreBands)

  return {
    ...header,
    week,
    jobs,
    adventures: samples.adventures,
    weeklyClears,
    fameBands: samples.fameBands,
    weekOverWeek,
    weekMoves,
    streaks: samples.streaks,
    scoreBands,
    scoreBandMinPopulation,
    ...times
  }
}
