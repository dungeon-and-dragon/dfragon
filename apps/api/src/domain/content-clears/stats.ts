import type {
  ClearWeekRatioCount,
  ContentClearKind,
  StoredClearPopulation
} from '@dfragon/database'
import { formatResetDate } from '@dfragon/server-core/domain/seoul-time.js'
import {
  type ClearContent,
  toLatestContents
} from '@dfragon/server-core/domain/content-clears/index.js'

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
  kind: ContentClearKind
  name: string
  releasedAt: string
  entryFame: number
  latest: boolean
}

export type ClearContentSummary = ClearContentHeader & { weeks: ClearWeek[] }

// 레기온은 지금 웹이 받는 kind가 아니라 contents와 따로 둔다.
export type ClearStats = { contents: ClearContentSummary[]; legions: ClearContentSummary[] }

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

export function toClearSummaries(
  contents: readonly ClearContent[],
  populations: readonly StoredClearPopulation[],
  counts: readonly ClearWeekRatioCount[]
): ClearContentSummary[] {
  const latestIds = new Set(toLatestContents(contents).map(({ id }) => id))

  return contents.map((content) => {
    const contentCounts = counts.filter(({ contentId }) => contentId === content.id)
    const weeks = populations
      .filter(({ contentId }) => contentId === content.id)
      .sort((left, right) => left.weekStart.getTime() - right.weekStart.getTime())
      .map((population) => toClearWeek(content, population, contentCounts))
    const header = toHeader(content, latestIds)

    return { ...header, weeks }
  })
}
