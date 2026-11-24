import { displayJobName } from '#entities/character'
import type { BarSeries } from '#shared/ui/chart/BarLineChart'
import type { BoxPlotRow } from '#shared/ui/chart/BoxPlot'
import type { LegendItem } from '#shared/ui/chart/ChartLegend'
import type { ColumnBar } from '#shared/ui/chart/Columns'
import type { LineSeries } from '#shared/ui/chart/LineChart'
import type { ChartX } from '#shared/ui/chart/plot-layout'
import type { Bar } from '#shared/ui/chart/RowBars'
import type { SplitSegment } from '#shared/ui/chart/SplitBar'
import {
  type ClearContent,
  type ClearContentStats,
  type ClearFameDistribution,
  type ClearJob,
  type ClearScoreBand,
  type ClearStageMoves,
  type ClearWeek,
  type ClearWeekOverWeek,
  shareText
} from '#entities/ranking'
import { type ContentChoice, type GroupedContent, groupsOf } from './clear-groups'
import { columnsOf, type OverviewWeek, weekRangeText } from './clear-overview'
import { addDays, weekNumberOf } from './clear-weeks'
import { formatScoreTick, type JobMetric, jobStatsOf } from './clear-scores'

const integer = new Intl.NumberFormat('ko-KR')
const percent = new Intl.NumberFormat('ko-KR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
})

export function findGroup(
  contents: readonly ClearContent[],
  groupKey: string
): readonly GroupedContent[] | undefined {
  return groupsOf(contents).find((group) => group[0]?.place.group.key === groupKey)
}

export function findStage(
  group: readonly GroupedContent[],
  slug: string | undefined
): GroupedContent | undefined {
  const chosen = group.find(({ place }) => place.choice?.slug === slug)
  if (chosen !== undefined) {
    return chosen
  }

  return group[0]
}

export function stageChoices(group: readonly GroupedContent[]): ContentChoice[] {
  return group.flatMap(({ place }) => place.choice ?? [])
}

export function contentWeeks({ weeks }: ClearContent): OverviewWeek[] {
  return weeks.map(({ weekStart, closed }) => ({ weekStart, closed }))
}

export function weekNumberText(weekStart: string, releasedAt: string): string {
  return `${weekNumberOf(weekStart, releasedAt)}주차`
}

function previousWeekText(weekStart: string, releasedAt: string): string {
  return weekNumberText(addDays(weekStart, -7), releasedAt)
}

const WEEK_TICK_COUNT = 7

export type WeeklyClearChart = Readonly<{
  x: ChartX[]
  bars: BarSeries[]
  line: LineSeries
}>

export function weeklyClearChart(
  { kind, weeklyClears }: ClearContentStats,
  releasedAt: string
): WeeklyClearChart {
  const step = Math.max(1, Math.ceil(weeklyClears.length / WEEK_TICK_COUNT))
  const x = weeklyClears.map(({ weekStart }, index) => {
    const number = weekNumberText(weekStart, releasedAt)
    const title = `${number} ${weekRangeText(weekStart)}`
    const tick = index % step === 0 ? number : null

    return { key: weekStart, title, tick }
  })
  const repeat = weeklyClears.map(({ repeatCleared }) => repeatCleared)
  const first = weeklyClears.map(({ firstCleared }) => firstCleared)
  const ever = weeklyClears.map(({ everCleared, population }) => {
    if (population === 0) {
      return null
    }

    return (everCleared / population) * 100
  })
  const repeatBar = {
    key: 'repeat',
    name: '다시 클리어',
    color: 'var(--color-chart-base)',
    values: repeat
  }
  const firstBar = { key: 'first', name: '신규', color: 'var(--color-chart-1)', values: first }
  // 챌린지는 보상 칭호를 한 번만 얻어 다시 깼는지 기록에 남지 않는다.
  const bars = kind === 'challenge' ? [firstBar] : [repeatBar, firstBar]
  const line = {
    key: 'ever',
    name: '한 번이라도 깬 캐릭터 비율',
    color: 'var(--color-chart-2)',
    values: ever
  }

  return { x, bars, line }
}

const FAME_BAND = 2000
const FAME_TICK_COUNT = 4

export type FameBandChart = WeeklyClearChart

export function fameBandChart({ fameBands }: ClearContentStats): FameBandChart {
  const step = Math.max(1, Math.ceil(fameBands.length / FAME_TICK_COUNT))
  const x = fameBands.map(({ fame }, index) => {
    const low = integer.format(fame)
    const title = `${low} ~ ${integer.format(fame + FAME_BAND - 1)}`
    const tick = index % step === 0 ? low : null

    return { key: String(fame), title, tick }
  })
  const population = fameBands.map((band) => band.population)
  const cleared = fameBands.map((band) => band.cleared)
  const rate = fameBands.map((band) => {
    if (band.population === 0) {
      return null
    }

    return (band.cleared / band.population) * 100
  })
  const bars = [
    { key: 'population', name: '캐릭터 수', color: 'var(--color-chart-base)', values: population },
    { key: 'cleared', name: '클리어', color: 'var(--color-chart-1)', values: cleared }
  ]
  const line = { key: 'rate', name: '클리어율', color: 'var(--color-chart-2)', values: rate }

  return { x, bars, line }
}

export type Figure = Readonly<{ label: string; to?: string; value: string }>

export type SplitRow = Readonly<{
  key: string
  label: string
  total: string
  segments: SplitSegment[]
}>

export type SplitCard = Readonly<{
  figures: Figure[]
  rows: SplitRow[]
  legend: LegendItem[]
}>

function segment(key: string, name: string, value: number, color: string): SplitSegment {
  return { key, name, value, color, textColor: 'var(--color-fg)' }
}

function splitRow(key: string, label: string, segments: SplitSegment[]): SplitRow {
  const total = integer.format(segments.reduce((sum, { value }) => sum + value, 0))

  return { key, label, total, segments }
}

function legendOf(segments: readonly SplitSegment[]): LegendItem[] {
  const seen = new Map(segments.map(({ key, name, color }) => [key, { key, name, color }]))

  return [...seen.values()].map((item) => ({ ...item, mark: 'block' }))
}

export function weekOverWeekCard(
  { both, left, returned, first }: ClearWeekOverWeek,
  weekStart: string,
  releasedAt: string
): SplitCard {
  const leftCount = integer.format(left.cleared)
  const returnedCount = integer.format(returned.cleared)
  const firstCount = integer.format(first.cleared)
  const figures = [
    { label: '이탈', value: leftCount },
    { label: '복귀', value: returnedCount },
    { label: '신규', value: firstCount }
  ]
  const bothSegment = segment('both', '잔존', both.cleared, 'var(--color-chart-base)')
  const leftSegment = segment('left', '이탈', left.cleared, 'var(--color-chart-8)')
  const returnedSegment = segment('returned', '복귀', returned.cleared, 'var(--color-chart-3)')
  const firstSegment = segment('first', '신규', first.cleared, 'var(--color-chart-1)')
  const previous = splitRow('previous', previousWeekText(weekStart, releasedAt), [
    bothSegment,
    leftSegment
  ])
  const current = splitRow('current', weekNumberText(weekStart, releasedAt), [
    bothSegment,
    returnedSegment,
    firstSegment
  ])
  const legend = legendOf([bothSegment, leftSegment, returnedSegment, firstSegment])

  return { figures, rows: [previous, current], legend }
}

export function stageMoveCard(
  { hard, normal }: ClearStageMoves,
  weekStart: string,
  releasedAt: string
): SplitCard {
  const toHardCount = integer.format(hard.other)
  const toNormalCount = integer.format(normal.other)
  const figures = [
    { label: '일반', to: '하드', value: toHardCount },
    { label: '하드', to: '일반', value: toNormalCount }
  ]
  const current = weekNumberText(weekStart, releasedAt)
  const segmentsOf = (counts: ClearStageMoves['hard']) => [
    segment('same', '같은 단계', counts.same, 'var(--color-chart-base)'),
    segment('other', '이동', counts.other, 'var(--color-chart-7)'),
    segment('none', '클리어 없음', counts.none, 'var(--color-line-strong)')
  ]
  const hardSegments = segmentsOf(hard)
  const rows = [
    splitRow('hard', `${current} 하드`, hardSegments),
    splitRow('normal', `${current} 일반`, segmentsOf(normal))
  ]
  const legend = legendOf(hardSegments)

  return { figures, rows, legend }
}

type WeekGroup = ClearWeekOverWeek['both']

export function weekGroupRows(
  { both, returned, left, first }: ClearWeekOverWeek,
  pick: (group: WeekGroup) => ClearFameDistribution | null
): BoxPlotRow[] {
  const groups: readonly [string, string, string, ClearFameDistribution | null][] = [
    ['both', '잔존', 'var(--color-chart-base)', pick(both)],
    ['returned', '복귀', 'var(--color-chart-3)', pick(returned)],
    ['left', '이탈', 'var(--color-chart-8)', pick(left)],
    ['first', '신규', 'var(--color-chart-1)', pick(first)]
  ]

  return groups.flatMap(([key, name, color, stats]) => {
    if (stats === null) {
      return []
    }

    return [{ key, name, color, stats }]
  })
}

const SCORE_TICK_COUNT = 5

// 막대 높이는 그 구간 캐릭터 가운데 클리어한 비율이고, 가장 높은 구간을 기준으로 맞춘다.
export function scoreBandColumns(bands: readonly ClearScoreBand[]): ColumnBar[] {
  const step = Math.max(1, Math.ceil(bands.length / SCORE_TICK_COUNT))
  const rates = bands.map(({ population, cleared }) => (population > 0 ? cleared / population : 0))
  const maxRate = Math.max(0, ...rates)

  return bands.map(({ score, cleared }, index) => {
    const rate = rates[index] ?? 0
    const key = String(score)
    const label = index % step === 0 ? formatScoreTick(score) : null
    const range = `${integer.format(score)}~`
    const share = percent.format(rate)
    const ratio = maxRate > 0 ? rate / maxRate : 0

    return { key, label, range, count: cleared, share, ratio }
  })
}

export function stageBars(stages: ClearContentStats['stages']): Bar[] {
  if (stages === null || !stages.some(({ characters }) => characters > 0)) {
    return []
  }

  return stages.map(({ stage, characters }) => ({ key: stage, name: stage, value: characters }))
}

const STREAK_TICK_COUNT = 14

export function streakColumns(streaks: ClearContentStats['streaks']): ColumnBar[] {
  if (streaks === null) {
    return []
  }

  const step = Math.max(1, Math.ceil(streaks.length / STREAK_TICK_COUNT))
  const columns = columnsOf(
    streaks.map(({ weeks, characters }, index) => {
      const key = String(weeks)
      const label = index % step === 0 ? `${weeks}주` : null

      return { key, label, range: `${weeks}주 연속`, cleared: characters }
    })
  )
  if (!columns.some(({ count }) => count > 0)) {
    return []
  }

  return columns
}

function ratioLabel(ratio: number | null): string {
  if (ratio === null) {
    return '기본'
  }

  return `${100 + ratio}%`
}

// 배율 클리어가 한 번이라도 있는 컨텐츠는 배율 클리어가 없는 주에도 카드를 둔다.
export function ratioBars({ weeks }: ClearContent, { ratios }: ClearWeek): Bar[] {
  const hasRatioClears = weeks.some((item) =>
    item.ratios.some(({ ratio, cleared }) => ratio !== null && cleared > 0)
  )
  if (!hasRatioClears) {
    return []
  }

  const total = ratios.reduce((sum, { cleared }) => sum + cleared, 0)

  return ratios.map(({ ratio, cleared }) => {
    const share = shareText(cleared, total)

    return { key: String(ratio), name: ratioLabel(ratio), value: cleared, share }
  })
}

export type JobSort = 'rate' | 'cleared' | 'fame'

export const JOB_SORTS: readonly { value: JobSort; label: string }[] = [
  { value: 'rate', label: '클리어율 순' },
  { value: 'cleared', label: '클리어 순' },
  { value: 'fame', label: '명성 순' }
]

export type JobRow = Readonly<{
  key: string
  name: string
  counts: string
  rate: string
  stats: ClearFameDistribution | null
}>

type RankedJob = Readonly<{ row: JobRow; rate: number; cleared: number; median: number }>

const UNKNOWN_JOB_NAME = '알 수 없음'
const NO_RATE = '-'

function rankedJob(job: ClearJob, metric: JobMetric): RankedJob {
  const rate = job.population > 0 ? job.cleared / job.population : -1
  const name = displayJobName(job) ?? UNKNOWN_JOB_NAME
  const counts = `${integer.format(job.cleared)} / ${integer.format(job.population)}`
  const rateText = rate >= 0 ? percent.format(rate) : NO_RATE
  const stats = jobStatsOf(job, metric)
  const row = {
    key: `${job.jobId}/${job.jobGrowId}`,
    name,
    counts,
    rate: rateText,
    stats
  }
  const median = job.fame?.median ?? -1

  return { row, rate, cleared: job.cleared, median }
}

function compareJobs(sort: JobSort): (left: RankedJob, right: RankedJob) => number {
  if (sort === 'cleared') {
    return (left, right) => right.cleared - left.cleared || right.rate - left.rate
  }

  if (sort === 'fame') {
    return (left, right) => right.median - left.median || right.rate - left.rate
  }

  return (left, right) => right.rate - left.rate || right.cleared - left.cleared
}

export function jobRows(jobs: readonly ClearJob[], sort: JobSort, metric: JobMetric): JobRow[] {
  return jobs
    .map((job) => rankedJob(job, metric))
    .toSorted(compareJobs(sort))
    .map(({ row }) => row)
}
