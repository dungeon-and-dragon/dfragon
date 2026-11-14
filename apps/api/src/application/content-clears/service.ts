import type { StoredClearPopulation } from '@dfragon/database'
import { subWeeks } from 'date-fns'
import { CharacterDetailFailure } from '../../domain/character-failure.js'
import { toRaidStageLabel } from '../../domain/raid-stage.js'
import { formatResetDate } from '../../domain/seoul-time.js'
import {
  CLEAR_CONTENTS,
  type ClearContent,
  findStagePair,
  toCollectionMinFame,
  toPopulationMinFame
} from '../../domain/content-clears/contents.js'
import {
  type ClearContentStats,
  toClearContentStats,
  toEmptyContentStats,
  toLegionContentStats
} from '../../domain/content-clears/detail.js'
import { CLEAR_LEGIONS, toLegionSummaries } from '../../domain/content-clears/legions.js'
import {
  type ClearOverview,
  toClearOverview,
  toEmptyClearOverview
} from '../../domain/content-clears/overview.js'
import {
  type ClearStats,
  type ClearContentSummary,
  toClearStats
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
    const [populations, counts, legionCounts] = await Promise.all([
      reader.readPopulations(),
      reader.readWeekRatioCounts(),
      reader.readLegionWeeks(CLEAR_LEGIONS.map(({ name }) => name))
    ])
    const { contents } = toClearStats(populations, counts)
    const legions = toLegionSummaries(populations, legionCounts)
    const stats = { contents, legions }

    return { stats, populations }
  }

  const summaryOf = (current: ClearSnapshot): Promise<ClearSummary> => {
    current.summary ??= cacheUntilFailure(loadSummary(), () => {
      current.summary = undefined
    })

    return current.summary
  }

  // 단계 라벨은 수집 판정과 같은 함수로 정하고, 단계 라벨이 없는 기록(이내 황혼전)은 세지 않는다.
  const loadStages = async (raidName: string, weekStart: Date) => {
    const selection = { raidName, weekStart }
    const modes = await reader.readRaidModes(selection)
    const stages = modes.flatMap(({ modeName, hard }) => {
      const stage = toRaidStageLabel({ modeName, hard: hard ?? false })

      if (stage === null) {
        return []
      }

      return [{ modeName, hard, stage }]
    })

    if (stages.length === 0) {
      return []
    }

    return reader.readRaidStageCounts(selection, stages)
  }

  const loadContentStats = async (
    content: ClearContent,
    summary: ClearContentSummary,
    population: StoredClearPopulation | undefined
  ): Promise<ClearContentStats> => {
    if (population === undefined) {
      return toEmptyContentStats(summary)
    }

    const { weekStart } = population
    const previousWeekStart = subWeeks(weekStart, 1)
    const selection = { contentId: content.id, kind: content.kind, weekStart }
    const raid = content.kind === 'raid'
    const pair = findStagePair(content)
    const minFame = population.minFame ?? toPopulationMinFame(content, toCollectionMinFame())
    const comparison = { contentId: content.id, weekStart, previousWeekStart }
    const raidName = content.rule.type === 'clear' ? content.rule.name : undefined
    const [
      jobFames,
      jobScores,
      adventures,
      firstWeeks,
      fameBands,
      scoreBands,
      times,
      weekGroups,
      weekGroupScores,
      stageMoveCounts,
      streaks,
      stages
    ] = await Promise.all([
      reader.readContentJobFames(selection),
      reader.readContentJobScores(selection),
      reader.readAdventureSizes(selection),
      reader.readFirstWeeks(content.id),
      reader.readFameBands(selection, minFame),
      reader.readScoreBands(selection, minFame),
      reader.readContentTimes(selection),
      raid ? reader.readWeekGroups(comparison) : null,
      raid ? reader.readWeekGroupScores(comparison) : null,
      pair !== undefined
        ? reader.readStageMoves({
            hardContentId: pair.hard.id,
            normalContentId: pair.normal.id,
            weekStart,
            previousWeekStart
          })
        : null,
      raid ? reader.readStreaks(selection) : null,
      raidName !== undefined ? loadStages(raidName, weekStart) : null
    ])

    const stageMoves =
      pair !== undefined && stageMoveCounts !== null ? { pair, counts: stageMoveCounts } : null

    return toClearContentStats(summary, population, {
      jobFames,
      jobScores,
      adventures,
      firstWeeks,
      fameBands,
      scoreBands,
      times,
      weekGroups,
      weekGroupScores,
      stageMoves,
      streaks,
      stages
    })
  }

  const loadOverview = async (
    weekStart: Date,
    populations: readonly StoredClearPopulation[]
  ): Promise<ClearOverview> => {
    // 한 주의 모든 컨텐츠를 읽는 쿼리는 PostgreSQL이 병렬 worker로 돌린다. 여섯 개를 함께 보내면 worker들이
    // 공유 메모리(shm)를 동시에 잡아 운영 DB에서 "could not resize shared memory segment"로 실패해 하나씩 읽는다.
    const fames = await reader.readFames(weekStart)
    const jobFames = await reader.readJobFames(weekStart)
    const scores = await reader.readScores(weekStart)
    const jobScores = await reader.readJobScores(weekStart)
    const coClears = await reader.readCoClears(weekStart)
    const raidTimes = await reader.readRaidTimes(weekStart)

    return toClearOverview(weekStart, populations, {
      fames,
      jobFames,
      scores,
      jobScores,
      coClears,
      raidTimes
    })
  }

  return {
    async stats() {
      return (await summaryOf(await currentSnapshot())).stats
    },
    async contentStats(contentId, weekStart) {
      const content = CLEAR_CONTENTS.find(({ id }) => id === contentId)
      const legion = CLEAR_LEGIONS.find(({ id }) => id === contentId)
      if (content === undefined && legion === undefined) {
        throw new CharacterDetailFailure('notFound')
      }
      const current = await currentSnapshot()
      const { stats, populations } = await summaryOf(current)
      const summary = [...stats.contents, ...stats.legions].find(({ id }) => id === contentId)
      if (summary === undefined) {
        throw new CharacterDetailFailure('notFound')
      }

      if (weekStart !== undefined && !summary.weeks.some((week) => week.weekStart === weekStart)) {
        throw new CharacterDetailFailure('query')
      }
      const selectedWeek = weekStart ?? summary.weeks.at(-1)?.weekStart ?? null

      if (content === undefined) {
        return toLegionContentStats(summary, selectedWeek)
      }

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
  readAdventureSizes: async () => [],
  readContentJobFames: async () => [],
  readContentTimes: async () => [],
  readFirstWeeks: async () => [],
  readFameBands: async () => [],
  readWeekGroups: async () => [],
  readStageMoves: async () => [],
  readStreaks: async () => [],
  readLegionWeeks: async () => [],
  readRaidModes: async () => [],
  readRaidStageCounts: async () => [],
  readContentJobScores: async () => [],
  readWeekGroupScores: async () => [],
  readScoreBands: async () => [],
  readScores: async () => [],
  readJobScores: async () => [],
  readFames: async () => [],
  readJobFames: async () => [],
  readCoClears: async () => [],
  readRaidTimes: async () => []
}
