import type {
  ClearJobCount,
  ClearWeekRatioCount,
  StoredClearPopulation,
  ClearAdventureSize
} from '@dfragon/database'
import { formatResetDate } from '../seoul-time.js'
import { CLEAR_CONTENTS, type ClearContent, toLatestContents } from './contents.js'

export type ClearRatioCount = {
  ratio: number | null
  cleared: number
}

export type ClearWeek = {
  weekStart: string
  closed: boolean
  collectedAt: string
  population: number
  minFame: number | null
  cleared: number
  newlyCleared: number | null
  ratios: ClearRatioCount[]
}

export type ClearContentHeader = {
  id: string
  kind: ClearContent['kind']
  name: string
  releasedAt: string
  entryFame: number
  latest: boolean
}

export type ClearContentSummary = ClearContentHeader & { weeks: ClearWeek[] }

export type ClearStats = { contents: ClearContentSummary[] }

export type ClearJobStats = {
  jobId: string | null
  jobGrowId: string | null
  jobName: string | null
  jobGrowName: string | null
  population: number
  cleared: number
}

export type ClearContentStats = ClearContentHeader & {
  week: ClearWeek | null
  jobs: ClearJobStats[]
  adventures: { characters: number; adventures: number }[]
}

function sumCleared(counts: readonly { cleared: number }[]): number {
  return counts.reduce((total, { cleared }) => total + cleared, 0)
}

function toRatios(counts: readonly ClearWeekRatioCount[]): ClearRatioCount[] {
  const ratios = new Map<number | null, number>()
  for (const { ratio, cleared } of counts) {
    ratios.set(ratio, (ratios.get(ratio) ?? 0) + cleared)
  }

  return [...ratios]
    .map(([ratio, cleared]) => ({ ratio, cleared }))
    .sort((left, right) => (left.ratio ?? -1) - (right.ratio ?? -1))
}

// 레이드는 그 주에 깬 수, 챌린지는 출시부터 그 주 끝까지 깬 누적 수와 그 주에 새로 깬 수다.
function toClearWeek(
  content: ClearContent,
  population: StoredClearPopulation,
  counts: readonly ClearWeekRatioCount[]
): ClearWeek {
  const weekStart = population.weekStart.getTime()
  const weekCounts = counts.filter((count) => count.weekStart.getTime() === weekStart)
  const clearCounts =
    content.kind === 'challenge'
      ? counts.filter((count) => count.weekStart.getTime() <= weekStart)
      : weekCounts
  const newlyCleared = content.kind === 'challenge' ? sumCleared(weekCounts) : null
  const cleared = sumCleared(clearCounts)
  const ratios = toRatios(clearCounts)

  const formattedWeekStart = formatResetDate(population.weekStart)
  const closed = population.closed
  const collectedAt = population.collectedAt.toISOString()
  const populationSize = population.population
  const minFame = population.minFame

  return {
    weekStart: formattedWeekStart,
    closed,
    collectedAt,
    population: populationSize,
    minFame,
    cleared,
    newlyCleared,
    ratios
  }
}

function toHeader(content: ClearContent, latestIds: ReadonlySet<string>): ClearContentHeader {
  const { id, kind, name, entryFame } = content
  const releasedAt = content.releasedAt.toISOString()
  const latest = latestIds.has(id)

  return { id, kind, name, releasedAt, entryFame, latest }
}

export function toClearStats(
  populations: readonly StoredClearPopulation[],
  counts: readonly ClearWeekRatioCount[]
): ClearStats {
  const latestIds = new Set(toLatestContents(CLEAR_CONTENTS).map(({ id }) => id))

  const contents = CLEAR_CONTENTS.map((content) => {
    const contentCounts = counts.filter(({ contentId }) => contentId === content.id)
    const weeks = populations
      .filter(({ contentId }) => contentId === content.id)
      .sort((left, right) => left.weekStart.getTime() - right.weekStart.getTime())
      .map((population) => toClearWeek(content, population, contentCounts))
    const header = toHeader(content, latestIds)

    return { ...header, weeks }
  })

  return { contents }
}

export function toClearJobKey(job: { jobId: string | null; jobGrowId: string | null }): string {
  return JSON.stringify([job.jobId, job.jobGrowId])
}

// 모집단을 저장한 뒤 전직을 바꾼 캐릭터처럼 모집단에 없는 전직의 클리어도 모집단 0으로 넣어, 클리어 수의 합이 그 주 클리어 수와 같게 한다.
export function toClearJobStats(
  population: StoredClearPopulation,
  clears: readonly ClearJobCount[]
): ClearJobStats[] {
  const jobs = new Map<string, ClearJobStats>()
  for (const { count, ...job } of population.jobs) {
    jobs.set(toClearJobKey(job), { ...job, population: count, cleared: 0 })
  }

  for (const { cleared, ...job } of clears) {
    const key = toClearJobKey(job)
    const stats = jobs.get(key) ?? { ...job, population: 0, cleared: 0 }
    jobs.set(key, { ...stats, cleared: stats.cleared + cleared })
  }

  return [...jobs.values()]
}

export function toEmptyContentStats({
  weeks: _weeks,
  ...header
}: ClearContentSummary): ClearContentStats {
  return { ...header, week: null, jobs: [], adventures: [] }
}

export function toClearContentStats(
  { weeks, ...header }: ClearContentSummary,
  population: StoredClearPopulation,
  jobCounts: readonly ClearJobCount[],
  adventures: ClearAdventureSize[]
): ClearContentStats {
  const weekStart = formatResetDate(population.weekStart)
  const week = weeks.find((summaryWeek) => summaryWeek.weekStart === weekStart) ?? null
  const jobs = toClearJobStats(population, jobCounts)

  return { ...header, week, jobs, adventures }
}
