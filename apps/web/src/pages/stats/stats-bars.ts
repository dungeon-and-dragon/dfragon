import { formatJobName } from '#core/character/job-format'
import { CHARACTER_SERVER_NAMES } from '#core/character/character-summary'
import type { CharacterStats } from '#core/ranking/ranking-stats'
import type { Bar } from '../../components/chart/RowBars'

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

export function serverBars({ servers, total }: CharacterStats): Bar[] {
  return servers.map(({ serverId, count }) => ({
    key: serverId,
    name: CHARACTER_SERVER_NAMES[serverId],
    value: count,
    share: shareText(count, total)
  }))
}

function awakenedJobs({ jobs }: CharacterStats): CharacterStats['jobs'] {
  return jobs.filter(({ jobGrowName }) => jobGrowName.startsWith(AWAKENING_MARK))
}

export function jobBars(stats: CharacterStats): Bar[] {
  return awakenedJobs(stats).map(({ jobId, jobGrowId, jobGrowName, count }) => ({
    key: `${jobId}/${jobGrowId}`,
    name: formatJobName(jobGrowName),
    value: count,
    share: shareText(count, stats.total)
  }))
}

export function averageFameBars(stats: CharacterStats): Bar[] {
  return awakenedJobs(stats)
    .flatMap(({ jobId, jobGrowId, jobGrowName, averageFame }) => {
      if (averageFame == null) {
        return []
      }

      return [
        { key: `${jobId}/${jobGrowId}`, name: formatJobName(jobGrowName), value: averageFame }
      ]
    })
    .toSorted((a, b) => b.value - a.value)
}

export type FameBar = Readonly<{
  key: string
  label: string | null
  range: string
  count: number
  ratio: number
  fine: boolean
}>

type FameBucket = CharacterStats['fameDistribution'][number]

const FINE_FROM = 120_000
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

export function fameBars({ fameDistribution }: CharacterStats): FameBar[] {
  if (fameDistribution.length === 0) {
    return []
  }

  const distribution = fameDistribution.toSorted((a, b) => a.from - b.from)
  const coarse = coarseBuckets(distribution)
  const fine = fineBuckets(distribution)
  const maxDensity = Math.max(...[...coarse, ...fine].map(densityOf))

  function barOf(bucket: FameBucket, isFine: boolean): FameBar {
    const { from, to, count } = bucket
    const labeled = !isFine || from % LABEL_STEP === 0
    const label = labeled ? fameText(from) : null
    const range = `${fameText(from)}~${fameText(to)}`
    const ratio = maxDensity > 0 ? densityOf(bucket) / maxDensity : 0

    return { key: String(from), label, range, count, ratio, fine: isFine }
  }

  return [
    ...coarse.map((bucket) => barOf(bucket, false)),
    ...fine.map((bucket) => barOf(bucket, true))
  ]
}
