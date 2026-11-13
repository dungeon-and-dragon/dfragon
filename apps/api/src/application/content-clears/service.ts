import type { StoredClearPopulation } from '@dfragon/database'
import { CharacterDetailFailure } from '../../domain/character-failure.js'
import { formatResetDate } from '../../domain/seoul-time.js'
import { CLEAR_CONTENTS, type ClearContent } from '../../domain/content-clears/contents.js'
import {
  type ClearOverview,
  toClearOverview,
  toEmptyClearOverview
} from '../../domain/content-clears/overview.js'
import {
  type ClearStats,
  type ClearContentStats,
  type ClearContentSummary,
  toClearStats,
  toEmptyContentStats,
  toClearContentStats
} from '../../domain/content-clears/stats.js'
import type { ClearStatsReader } from './ports.js'

export interface ClearStatsService {
  stats(): Promise<ClearStats>
  contentStats(contentId: string, weekStart: string | undefined): Promise<ClearContentStats>
  overview(weekStart: string | undefined): Promise<ClearOverview>
}

type ClearSummary = {
  stats: ClearStats
  populations: StoredClearPopulation[]
}

type ClearSnapshot = {
  collectedAt: number | null
  summary?: Promise<ClearSummary>
  contentStats: Map<string, Promise<ClearContentStats>>
  overviews: Map<string, Promise<ClearOverview>>
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
      snapshot = { collectedAt, contentStats: new Map(), overviews: new Map() }
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
    summary: ClearContentSummary,
    population: StoredClearPopulation | undefined
  ): Promise<ClearContentStats> => {
    if (population === undefined) {
      return toEmptyContentStats(summary)
    }
    const selection = { contentId: content.id, kind: content.kind, weekStart: population.weekStart }
    const [jobCounts, adventures] = await Promise.all([
      reader.readJobCounts(selection),
      reader.readAdventureSizes(selection)
    ])

    return toClearContentStats(summary, population, jobCounts, adventures)
  }

  const loadOverview = async (
    weekStart: Date,
    populations: readonly StoredClearPopulation[]
  ): Promise<ClearOverview> => {
    const [fames, jobFames, coClears, raidTimes] = await Promise.all([
      reader.readFames(weekStart),
      reader.readJobFames(weekStart),
      reader.readCoClears(weekStart),
      reader.readRaidTimes(weekStart)
    ])

    return toClearOverview(weekStart, populations, { fames, jobFames, coClears, raidTimes })
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
    },
    async overview(weekStart) {
      const current = await currentSnapshot()
      const { populations } = await summaryOf(current)
      const weekStarts = new Map(
        populations.map((population) => [
          formatResetDate(population.weekStart),
          population.weekStart
        ])
      )

      const selectedWeek = weekStart ?? [...weekStarts.keys()].sort().at(-1)

      if (selectedWeek === undefined) {
        return toEmptyClearOverview()
      }

      const selectedWeekStart = weekStarts.get(selectedWeek)

      if (selectedWeekStart === undefined) {
        throw new CharacterDetailFailure('query')
      }

      const cached = current.overviews.get(selectedWeek)

      if (cached !== undefined) {
        return cached
      }

      const loading = cacheUntilFailure(loadOverview(selectedWeekStart, populations), () => {
        current.overviews.delete(selectedWeek)
      })
      current.overviews.set(selectedWeek, loading)

      return loading
    }
  }
}

export const emptyClearStatsReader: ClearStatsReader = {
  readCollectedAt: async () => null,
  readPopulations: async () => [],
  readWeekRatioCounts: async () => [],
  readJobCounts: async () => [],
  readAdventureSizes: async () => [],
  readFames: async () => [],
  readJobFames: async () => [],
  readCoClears: async () => [],
  readRaidTimes: async () => []
}
