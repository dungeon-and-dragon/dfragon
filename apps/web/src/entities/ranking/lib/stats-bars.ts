import { displayJobName } from '#entities/character/@x/ranking'
import type { CharacterStats } from '#entities/ranking/model/ranking-stats'
import type { BarSeries } from '#shared/ui/chart/BarLineChart'
import type { ColumnBar } from '#shared/ui/chart/Columns'
import type { ChartX } from '#shared/ui/chart/plot-layout'

const AWAKENING_MARK = '眞'

const percent = new Intl.NumberFormat('ko-KR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
})

export function shareText(count: number, total: number): string {
  if (total <= 0) {
    return percent.format(0)
  }

  return percent.format(count / total)
}

export function isAwakenedJob({ jobGrowName }: Readonly<{ jobGrowName: string | null }>): boolean {
  return jobGrowName !== null && jobGrowName.startsWith(AWAKENING_MARK)
}

export type JobFameChart = Readonly<{ x: ChartX[]; bars: BarSeries[] }>

const JOB_FAME_BANDS = [
  { key: 'under-80k', name: '8만 미만', from: 0, color: 'var(--color-chart-1)' },
  { key: '80k-100k', name: '8만~10만', from: 80_000, color: 'var(--color-chart-3)' },
  { key: '100k-120k', name: '10만~12만', from: 100_000, color: 'var(--color-chart-4)' },
  { key: '120k-130k', name: '12만~13만', from: 120_000, color: 'var(--color-chart-2)' },
  { key: 'from-130k', name: '13만 이상', from: 130_000, color: 'var(--color-chart-8)' }
] as const

function bandIndexOf(fame: number): number {
  return JOB_FAME_BANDS.findLastIndex(({ from }) => fame >= from)
}

export function jobFameChart({ jobs }: CharacterStats): JobFameChart {
  const awakened = jobs.filter(isAwakenedJob)
  const x = awakened.map(({ jobId, jobGrowId, jobName, jobGrowName }) => {
    const key = `${jobId}/${jobGrowId}`
    const name = displayJobName({ jobName, jobGrowName })

    return { key, title: name, tick: name }
  })
  const countsByJob = awakened.map(({ fameBuckets }) => {
    const counts = JOB_FAME_BANDS.map(() => 0)

    for (const { from, count } of fameBuckets) {
      counts[bandIndexOf(from)] += count
    }

    return counts
  })
  const bars = JOB_FAME_BANDS.map(({ key, name, color }, band) => {
    const values = countsByJob.map((counts) => counts[band] ?? 0)

    return { key, name, color, values }
  })

  return { x, bars }
}

type FameGroup = 'coarse' | 'fine' | 'high'

export type FameBar = ColumnBar & Readonly<{ group: FameGroup }>

type FameBucket = CharacterStats['fameDistribution'][number]

const FINE_FROM = 120_000
const HIGH_FROM = 130_000
const COARSE_WIDTH = 40_000
const LABEL_STEP = 5_000
const DENSITY_WIDTH = 1_000
const MAN = 10_000

const manwon = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1, useGrouping: false })

function fameText(fame: number): string {
  if (fame === 0) {
    return '0'
  }

  return `${manwon.format(fame / MAN)}만`
}

function coarseBuckets(distribution: readonly FameBucket[]): FameBucket[] {
  return Array.from({ length: FINE_FROM / COARSE_WIDTH }, (_, index) => {
    const from = index * COARSE_WIDTH
    const to = from + COARSE_WIDTH
    const count = distribution
      .filter((bucket) => bucket.from >= from && bucket.from < to)
      .reduce((sum, bucket) => sum + bucket.count, 0)

    return { from, to, count }
  })
}

function fineBuckets(distribution: readonly FameBucket[]): FameBucket[] {
  const received = distribution.filter(({ from }) => from >= FINE_FROM)
  const highest = received.at(-1)
  if (highest == null) {
    return []
  }

  const width = highest.to - highest.from
  const countByFrom = new Map(received.map(({ from, count }) => [from, count]))

  return Array.from({ length: (highest.from - FINE_FROM) / width + 1 }, (_, index) => {
    const from = FINE_FROM + index * width
    const to = from + width
    const count = countByFrom.get(from) ?? 0

    return { from, to, count }
  })
}

function densityOf({ from, to, count }: FameBucket): number {
  return count / ((to - from) / DENSITY_WIDTH)
}

function maxDensityOf(buckets: readonly FameBucket[]): number {
  return Math.max(0, ...buckets.map(densityOf))
}

export function fameBars({ fameDistribution }: CharacterStats): FameBar[] {
  if (fameDistribution.length === 0) {
    return []
  }

  const distribution = fameDistribution.toSorted((a, b) => a.from - b.from)
  const coarse = coarseBuckets(distribution)
  const allFine = fineBuckets(distribution)
  const fine = allFine.filter(({ from }) => from < HIGH_FROM)
  const high = allFine.filter(({ from }) => from >= HIGH_FROM)
  const sharedMaxDensity = maxDensityOf([...coarse, ...fine])
  const highMaxDensity = maxDensityOf(high)

  function barOf(bucket: FameBucket, group: FameGroup, maxDensity: number): FameBar {
    const { from, to, count } = bucket
    const labeled = group === 'coarse' || from % LABEL_STEP === 0
    const label = labeled ? fameText(from) : null
    const range = `${fameText(from)}~${fameText(to)}`
    const ratio = maxDensity > 0 ? densityOf(bucket) / maxDensity : 0

    return { key: String(from), label, range, count, ratio, group }
  }

  return [
    ...coarse.map((bucket) => barOf(bucket, 'coarse', sharedMaxDensity)),
    ...fine.map((bucket) => barOf(bucket, 'fine', sharedMaxDensity)),
    ...high.map((bucket) => barOf(bucket, 'high', highMaxDensity))
  ]
}
