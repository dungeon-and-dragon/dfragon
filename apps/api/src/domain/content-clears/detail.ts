import type {
  CharacterScoreKind,
  ClearAdventureSize,
  ClearFameBandCount,
  ClearFirstWeekCount,
  ClearJobFameSample,
  ClearJobScoreSample,
  ClearRecordStageCount,
  ClearScoreBandCount,
  ClearStageMoveCount,
  ClearStagePrevious,
  ClearStreakCount,
  ClearTimeCount,
  ClearWeekGroup,
  ClearWeekGroupSample,
  ClearWeekGroupScoreSample,
  StoredClearPopulation
} from '@dfragon/database'
import { RAID_STAGE_ORDER } from '../raid-stage.js'
import { formatResetDate } from '../seoul-time.js'
import type { ClearStagePair } from './contents.js'
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
    stages: ClearRecordStageCount[] | null
    scoreBands: Record<CharacterScoreKind, ClearScoreBand[]>
  }

// 레이드가 아니면 weekGroups, weekGroupScores, streaks, stages가 null이고, 일반과 하드 짝이 없으면 stageMoves가 null이다.
export type ClearContentSamples = {
  jobFames: readonly ClearJobFameSample[]
  jobScores: readonly ClearJobScoreSample[]
  scoreBands: readonly ClearScoreBandCount[]
  weekGroupScores: readonly ClearWeekGroupScoreSample[] | null
  stages: readonly ClearRecordStageCount[] | null
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

function toStages(counts: readonly ClearRecordStageCount[]): ClearRecordStageCount[] {
  const orderOf = (stage: string) => {
    const index = RAID_STAGE_ORDER.indexOf(stage)

    if (index === -1) {
      return RAID_STAGE_ORDER.length
    }

    return index
  }

  return counts.toSorted(
    (left, right) =>
      orderOf(left.stage) - orderOf(right.stage) || left.stage.localeCompare(right.stage)
  )
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
    stages: null,
    scoreBands: { equipment: [], buff: [] },
    weekdays: [],
    hours: []
  }
}

// 레기온 기록에는 전직, 배율, 단계, 점수가 없어 상세는 고른 주의 요약만 준다.
export function toLegionContentStats(
  summary: ClearContentSummary,
  weekStart: string | null
): ClearContentStats {
  const week = summary.weeks.find((summaryWeek) => summaryWeek.weekStart === weekStart) ?? null
  const empty = toEmptyContentStats(summary)

  return { ...empty, week }
}

export function toClearContentStats(
  { weeks, ...header }: ClearContentSummary,
  population: StoredClearPopulation,
  samples: ClearContentSamples
): ClearContentStats {
  const weekStart = formatResetDate(population.weekStart)
  const week = weeks.find((summaryWeek) => summaryWeek.weekStart === weekStart) ?? null
  const jobs = toClearJobs(population, samples.jobFames, samples.jobScores)
  const weeklyClears = toWeeklyClears(weeks, samples.firstWeeks)
  const weekOverWeek =
    samples.weekGroups !== null
      ? toWeekOverWeek(samples.weekGroups, samples.weekGroupScores ?? [])
      : null
  const stageMoves = samples.stageMoves !== null ? toStageMoves(samples.stageMoves) : null
  const times = toClearTimes(samples.times)
  const stages = samples.stages !== null ? toStages(samples.stages) : null
  const scoreBands = toScoreBands(samples.scoreBands)

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
    stages,
    scoreBands,
    ...times
  }
}
