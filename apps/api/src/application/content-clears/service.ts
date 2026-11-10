import type { StoredClearPopulation } from '@dfragon/database'
import { CharacterDetailFailure } from '../../domain/character-failure.js'
import { formatResetDate } from '../../domain/seoul-time.js'
import { CLEAR_CONTENTS, type ClearContent } from '../../domain/content-clears/contents.js'
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
