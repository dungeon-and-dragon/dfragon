import type {
  ClearAdventureSize,
  ClearJobCount,
  ClearWeekRatioCount,
  ClearWeekSelection,
  StoredClearPopulation
} from '@dfragon/database'
import { CharacterDetailFailure } from '../characters/details/errors.js'
import { formatResetDate } from '../utils/seoul-time.js'
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
  adventures: ClearAdventureSize[]
}

export interface ClearStatsReader {
  readCollectedAt(): Promise<Date | null>
  readPopulations(): Promise<StoredClearPopulation[]>
  readWeekRatioCounts(): Promise<ClearWeekRatioCount[]>
  readJobCounts(selection: ClearWeekSelection): Promise<ClearJobCount[]>
  readAdventureSizes(selection: ClearWeekSelection): Promise<ClearAdventureSize[]>
}

export interface ClearStatsService {
  stats(): Promise<ClearStats>
  contentStats(contentId: string, weekStart: string | undefined): Promise<ClearContentStats>
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

  return {
    weekStart: formatResetDate(population.weekStart),
    closed: population.closed,
    collectedAt: population.collectedAt.toISOString(),
    population: population.population,
    minFame: population.minFame,
    cleared,
    newlyCleared,
    ratios
  }
}

function toHeader(content: ClearContent, latestIds: ReadonlySet<string>): ClearContentHeader {
  return {
    id: content.id,
    kind: content.kind,
    name: content.name,
    releasedAt: content.releasedAt.toISOString(),
    entryFame: content.entryFame,
    latest: latestIds.has(content.id)
  }
}

function toClearStats(
  populations: readonly StoredClearPopulation[],
  counts: readonly ClearWeekRatioCount[]
): ClearStats {
  const latestIds = new Set(toLatestContents(CLEAR_CONTENTS).map(({ id }) => id))

  return {
    contents: CLEAR_CONTENTS.map((content) => {
      const contentCounts = counts.filter(({ contentId }) => contentId === content.id)
      const weeks = populations
        .filter(({ contentId }) => contentId === content.id)
        .sort((left, right) => left.weekStart.getTime() - right.weekStart.getTime())
        .map((population) => toClearWeek(content, population, contentCounts))

      return { ...toHeader(content, latestIds), weeks }
    })
  }
}

// 모집단을 저장한 뒤 전직을 바꾼 캐릭터처럼 모집단에 없는 전직의 클리어도 모집단 0으로 넣어, 클리어 수의 합이 그 주 클리어 수와 같게 한다.
function toClearJobStats(
  population: StoredClearPopulation,
  clears: readonly ClearJobCount[]
): ClearJobStats[] {
  const jobs = new Map<string, ClearJobStats>()
  const keyOf = (job: { jobId: string | null; jobGrowId: string | null }) =>
    JSON.stringify([job.jobId, job.jobGrowId])
  for (const { count, ...job } of population.jobs) {
    jobs.set(keyOf(job), { ...job, population: count, cleared: 0 })
  }

  for (const { cleared, ...job } of clears) {
    const key = keyOf(job)
    const stats = jobs.get(key) ?? { ...job, population: 0, cleared: 0 }
    jobs.set(key, { ...stats, cleared: stats.cleared + cleared })
  }

  return [...jobs.values()]
}

type ClearSummary = {
  stats: ClearStats
  populations: StoredClearPopulation[]
}

type ClearSnapshot = {
  collectedAt: number | null
  summary?: Promise<ClearSummary>
  contentStats: Map<string, Promise<ClearContentStats>>
}

function cacheUntilFailure<T>(load: Promise<T>, forget: () => void): Promise<T> {
  return load.catch((error: unknown) => {
    forget()
    throw error
  })
}

// 수집은 worker 프로세스가 하므로 요청마다 마지막 수집 시각을 읽어, 바뀌었으면 캐시를 버린다.
export function createClearStatsService(reader: ClearStatsReader): ClearStatsService {
  let snapshot: ClearSnapshot | undefined

  const currentSnapshot = async (): Promise<ClearSnapshot> => {
    const collectedAt = (await reader.readCollectedAt())?.getTime() ?? null
    if (snapshot?.collectedAt !== collectedAt) {
      snapshot = { collectedAt, contentStats: new Map() }
    }

    return snapshot
  }

  const loadSummary = async (): Promise<ClearSummary> => {
    const [populations, counts] = await Promise.all([
      reader.readPopulations(),
      reader.readWeekRatioCounts()
    ])
    const stats = toClearStats(populations, counts)

    return { stats, populations }
  }

  const summaryOf = (current: ClearSnapshot): Promise<ClearSummary> => {
    current.summary ??= cacheUntilFailure(loadSummary(), () => {
      current.summary = undefined
    })

    return current.summary
  }

  const loadContentStats = async (
    content: ClearContent,
    { weeks, ...header }: ClearContentSummary,
    population: StoredClearPopulation | undefined
  ): Promise<ClearContentStats> => {
    if (population === undefined) {
      return { ...header, week: null, jobs: [], adventures: [] }
    }
    const selection = { contentId: content.id, kind: content.kind, weekStart: population.weekStart }
    const [jobCounts, adventures] = await Promise.all([
      reader.readJobCounts(selection),
      reader.readAdventureSizes(selection)
    ])
    const weekStart = formatResetDate(population.weekStart)
    const week = weeks.find((summaryWeek) => summaryWeek.weekStart === weekStart) ?? null
    const jobs = toClearJobStats(population, jobCounts)

    return { ...header, week, jobs, adventures }
  }

  return {
    async stats() {
      return (await summaryOf(await currentSnapshot())).stats
    },
    async contentStats(contentId, weekStart) {
      const content = CLEAR_CONTENTS.find(({ id }) => id === contentId)
      if (content === undefined) {
        throw new CharacterDetailFailure('notFound')
      }
      const current = await currentSnapshot()
      const { stats, populations } = await summaryOf(current)
      const summary = stats.contents.find(({ id }) => id === contentId)
      if (summary === undefined) {
        throw new CharacterDetailFailure('notFound')
      }

      if (weekStart !== undefined && !summary.weeks.some((week) => week.weekStart === weekStart)) {
        throw new CharacterDetailFailure('query')
      }
      const selectedWeek = weekStart ?? summary.weeks.at(-1)?.weekStart ?? null
      const key = JSON.stringify([contentId, selectedWeek])
      const cached = current.contentStats.get(key)
      if (cached !== undefined) {
        return cached
      }
      const population = populations.find(
        (stored) =>
          stored.contentId === contentId && formatResetDate(stored.weekStart) === selectedWeek
      )
      const loading = cacheUntilFailure(loadContentStats(content, summary, population), () => {
        current.contentStats.delete(key)
      })
      current.contentStats.set(key, loading)

      return loading
    }
  }
}

export const emptyClearStatsReader: ClearStatsReader = {
  readCollectedAt: async () => null,
  readPopulations: async () => [],
  readWeekRatioCounts: async () => [],
  readJobCounts: async () => [],
  readAdventureSizes: async () => []
}
