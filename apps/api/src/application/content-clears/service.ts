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
  // 실패는 던지지 않고 진단 code로 남긴다.
  refresh(): Promise<void>
  // 진행 중인 계산은 끝을 기다리지 않고, 줄에서 기다리던 계산과 닫은 뒤 온 계산은 실패시킨다.
  close(): void
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

type ClearRefresh = {
  snapshot: ClearSnapshot
  ready: Promise<void>
}

function cacheUntilFailure<T>(load: Promise<T>, forget: () => void): Promise<T> {
  return load.catch((error: unknown) => {
    forget()
    throw error
  })
}

class ClearStatsClosed extends Error {
  constructor() {
    super('Clear stats service is closed')
    this.name = 'ClearStatsClosed'
  }
}

// 운영에서 캐시가 빈 DB의 첫 계산은 전체 개요 약 30초, 컨텐츠 상세 12~55초다. 여러 계산을 함께 돌리면 DB CPU와
// 연결을 모두 잡아 다른 경로가 멈추므로(2026-11-14 장애) 계산은 한 번에 하나씩 돈다.
function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve()
  let closed = false

  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      const result = tail.then(() => {
        if (closed) {
          throw new ClearStatsClosed()
        }

        return task()
      })

      tail = result.catch(() => undefined)

      return result
    },
    close() {
      closed = true
    }
  }
}

// 수집은 worker 프로세스가 하므로 요청마다 마지막 수집 시각을 읽는다. 바뀌었으면 새 시각의 결과를 미리 계산하고,
// 그동안은 이전 시각의 결과를 준다.
export function createClearStatsService(
  reader: ClearStatsReader,
  reportRefreshFailure: () => void
): ClearStatsService {
  const queue = createSerialQueue()
  let served: ClearSnapshot | undefined
  let refreshing: ClearRefresh | undefined

  const loadSummary = async (): Promise<ClearSummary> => {
    const populations = await reader.readPopulations()
    const counts = await reader.readWeekRatioCounts()
    const legionCounts = await reader.readLegionWeeks(CLEAR_LEGIONS.map(({ name }) => name))
    const { contents } = toClearStats(populations, counts)
    const legions = toLegionSummaries(populations, legionCounts)
    const stats = { contents, legions }

    return { stats, populations }
  }

  const summaryOf = (current: ClearSnapshot): Promise<ClearSummary> => {
    current.summary ??= cacheUntilFailure(queue.run(loadSummary), () => {
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
    const jobFames = await reader.readContentJobFames(selection)
    const jobScores = await reader.readContentJobScores(selection)
    const adventures = await reader.readAdventureSizes(selection)
    const firstWeeks = await reader.readFirstWeeks(content.id)
    const fameBands = await reader.readFameBands(selection, minFame)
    const scoreBands = await reader.readScoreBands(selection, minFame)
    const times = await reader.readContentTimes(selection)
    const weekGroups = raid ? await reader.readWeekGroups(comparison) : null
    const weekGroupScores = raid ? await reader.readWeekGroupScores(comparison) : null
    const stageMoveCounts =
      pair !== undefined
        ? await reader.readStageMoves({
            hardContentId: pair.hard.id,
            normalContentId: pair.normal.id,
            weekStart,
            previousWeekStart
          })
        : null

    const streaks = raid ? await reader.readStreaks(selection) : null
    const stages = raidName !== undefined ? await loadStages(raidName, weekStart) : null

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

  const contentStatsOf = async (
    current: ClearSnapshot,
    contentId: string,
    weekStart: string | undefined
  ): Promise<ClearContentStats> => {
    const content = CLEAR_CONTENTS.find(({ id }) => id === contentId)
    const legion = CLEAR_LEGIONS.find(({ id }) => id === contentId)
    if (content === undefined && legion === undefined) {
      throw new CharacterDetailFailure('notFound')
    }

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

    const loading = cacheUntilFailure(
      queue.run(() => loadContentStats(content, summary, population)),
      () => {
        current.contentStats.delete(key)
      }
    )

    current.contentStats.set(key, loading)

    return loading
  }

  const overviewOf = async (
    current: ClearSnapshot,
    weekStart: string | undefined
  ): Promise<ClearOverview> => {
    const { populations } = await summaryOf(current)
    const weekStarts = new Map(
      populations.map((population) => [formatResetDate(population.weekStart), population.weekStart])
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

    const loading = cacheUntilFailure(
      queue.run(() => loadOverview(selectedWeekStart, populations)),
      () => {
        current.overviews.delete(selectedWeek)
      }
    )

    current.overviews.set(selectedWeek, loading)

    return loading
  }

  // 미리 계산은 한 항목씩 줄에 넣어, 그동안 온 요청이 남은 미리 계산 전체가 아니라 지금 도는 계산 하나만 기다리게 한다.
  const warm = async (current: ClearSnapshot): Promise<void> => {
    await summaryOf(current)

    const loads = [
      () => overviewOf(current, undefined),
      ...CLEAR_CONTENTS.map(
        ({ id }) =>
          () =>
            contentStatsOf(current, id, undefined)
      )
    ]

    for (const load of loads) {
      try {
        await load()
      } catch (error) {
        if (error instanceof ClearStatsClosed) {
          return
        }

        reportRefreshFailure()
      }
    }
  }

  const emptySnapshot = (collectedAt: number | null): ClearSnapshot => ({
    collectedAt,
    contentStats: new Map(),
    overviews: new Map()
  })

  const readCollectedAt = async (): Promise<number | null> => {
    const collectedAt = await reader.readCollectedAt()

    if (collectedAt === null) {
      return null
    }

    return collectedAt.getTime()
  }

  const refreshTo = (collectedAt: number | null): ClearRefresh => {
    if (refreshing?.snapshot.collectedAt === collectedAt) {
      return refreshing
    }

    const snapshot = emptySnapshot(collectedAt)
    const ready = warm(snapshot).then(
      () => {
        if (refreshing?.snapshot === snapshot) {
          served = snapshot
          refreshing = undefined
        }
      },
      (error: unknown) => {
        if (refreshing?.snapshot === snapshot) {
          refreshing = undefined
        }

        if (!(error instanceof ClearStatsClosed)) {
          reportRefreshFailure()
        }
      }
    )

    refreshing = { snapshot, ready }

    return refreshing
  }

  const currentSnapshot = async (): Promise<ClearSnapshot> => {
    const collectedAt = await readCollectedAt()

    if (served !== undefined) {
      if (served.collectedAt !== collectedAt) {
        refreshTo(collectedAt)
      }

      return served
    }

    if (refreshing?.snapshot.collectedAt === collectedAt) {
      return refreshing.snapshot
    }

    // 이전 결과가 없으면 미리 계산하지 않고 요청한 것만 계산한다. 더 오래된 시각의 미리 계산이 끝나도 이 결과를 덮지 않게 버린다.
    served = emptySnapshot(collectedAt)
    refreshing = undefined

    return served
  }

  return {
    async stats() {
      return (await summaryOf(await currentSnapshot())).stats
    },
    async contentStats(contentId, weekStart) {
      return contentStatsOf(await currentSnapshot(), contentId, weekStart)
    },
    async overview(weekStart) {
      return overviewOf(await currentSnapshot(), weekStart)
    },
    async refresh() {
      try {
        const collectedAt = await readCollectedAt()

        if (served?.collectedAt !== collectedAt) {
          await refreshTo(collectedAt).ready
        }
      } catch {
        // 요청이 아니라 응답할 곳이 없으므로 진단 code만 남긴다.
        reportRefreshFailure()
      }
    },
    close() {
      queue.close()
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
