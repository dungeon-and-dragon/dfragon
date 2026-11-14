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
import type { ClearStatsRepository } from './repository.js'

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

function emptySnapshot(collectedAt: number | null): ClearSnapshot {
  return {
    collectedAt,
    contentStats: new Map(),
    overviews: new Map()
  }
}

// 수집은 worker 프로세스가 하므로 요청마다 마지막 수집 시각을 읽는다. 바뀌었으면 새 시각의 결과를 미리 계산하고,
// 그동안은 이전 시각의 결과를 준다.
export class ClearStatsService {
  private readonly queue = createSerialQueue()
  private served: ClearSnapshot | undefined
  private refreshing: ClearRefresh | undefined

  constructor(
    private readonly repository: ClearStatsRepository,
    private readonly reportRefreshFailure: () => void
  ) {}

  async stats(): Promise<ClearStats> {
    return (await this.summaryOf(await this.currentSnapshot())).stats
  }

  async contentStats(contentId: string, weekStart: string | undefined): Promise<ClearContentStats> {
    return this.contentStatsOf(await this.currentSnapshot(), contentId, weekStart)
  }

  async overview(weekStart: string | undefined): Promise<ClearOverview> {
    return this.overviewOf(await this.currentSnapshot(), weekStart)
  }

  // 실패는 던지지 않고 진단 code로 남긴다.
  async refresh(): Promise<void> {
    try {
      const collectedAt = await this.readCollectedAt()

      if (this.served?.collectedAt !== collectedAt) {
        await this.refreshTo(collectedAt).ready
      }
    } catch {
      // 요청이 아니라 응답할 곳이 없으므로 진단 code만 남긴다.
      this.reportRefreshFailure()
    }
  }

  // 진행 중인 계산은 끝을 기다리지 않고, 줄에서 기다리던 계산과 닫은 뒤 온 계산은 실패시킨다.
  close(): void {
    this.queue.close()
  }

  private async loadSummary(): Promise<ClearSummary> {
    // 마감하지 않은 주는 다 받지 않은 값이라 보여 주지 않는다.
    const populations = (await this.repository.readPopulations()).filter(({ closed }) => closed)
    const counts = await this.repository.readWeekRatioCounts()
    const legionCounts = await this.repository.readLegionWeeks(
      CLEAR_LEGIONS.map(({ name }) => name)
    )
    const { contents } = toClearStats(populations, counts)
    const legions = toLegionSummaries(populations, legionCounts)
    const stats = { contents, legions }

    return { stats, populations }
  }

  private summaryOf(current: ClearSnapshot): Promise<ClearSummary> {
    current.summary ??= cacheUntilFailure(
      this.queue.run(() => this.loadSummary()),
      () => {
        current.summary = undefined
      }
    )

    return current.summary
  }

  // 단계 라벨은 수집 판정과 같은 함수로 정하고, 단계 라벨이 없는 기록(이내 황혼전)은 세지 않는다.
  private async loadStages(raidName: string, weekStart: Date) {
    const selection = { raidName, weekStart }
    const modes = await this.repository.readRaidModes(selection)
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

    return this.repository.readRaidStageCounts(selection, stages)
  }

  private async loadContentStats(
    content: ClearContent,
    summary: ClearContentSummary,
    population: StoredClearPopulation | undefined
  ): Promise<ClearContentStats> {
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
    const jobFames = await this.repository.readContentJobFames(selection)
    const jobScores = await this.repository.readContentJobScores(selection)
    const adventures = await this.repository.readAdventureSizes(selection)
    const firstWeeks = await this.repository.readFirstWeeks(content.id)
    const fameBands = await this.repository.readFameBands(selection, minFame)
    const scoreBands = await this.repository.readScoreBands(selection, minFame)
    const times = await this.repository.readContentTimes(selection)
    const weekGroups = raid ? await this.repository.readWeekGroups(comparison) : null
    const weekGroupScores = raid ? await this.repository.readWeekGroupScores(comparison) : null
    const stageMoveCounts =
      pair !== undefined
        ? await this.repository.readStageMoves({
            hardContentId: pair.hard.id,
            normalContentId: pair.normal.id,
            weekStart,
            previousWeekStart
          })
        : null

    const streaks = raid ? await this.repository.readStreaks(selection) : null
    const stages = raidName !== undefined ? await this.loadStages(raidName, weekStart) : null

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

  private async loadOverview(
    weekStart: Date,
    populations: readonly StoredClearPopulation[]
  ): Promise<ClearOverview> {
    // 한 주의 모든 컨텐츠를 읽는 쿼리는 PostgreSQL이 병렬 worker로 돌린다. 여섯 개를 함께 보내면 worker들이
    // 공유 메모리(shm)를 동시에 잡아 운영 DB에서 "could not resize shared memory segment"로 실패해 하나씩 읽는다.
    const fames = await this.repository.readFames(weekStart)
    const jobFames = await this.repository.readJobFames(weekStart)
    const scores = await this.repository.readScores(weekStart)
    const jobScores = await this.repository.readJobScores(weekStart)
    const coClears = await this.repository.readCoClears(weekStart)
    const raidTimes = await this.repository.readRaidTimes(weekStart)

    return toClearOverview(weekStart, populations, {
      fames,
      jobFames,
      scores,
      jobScores,
      coClears,
      raidTimes
    })
  }

  private async contentStatsOf(
    current: ClearSnapshot,
    contentId: string,
    weekStart: string | undefined
  ): Promise<ClearContentStats> {
    const content = CLEAR_CONTENTS.find(({ id }) => id === contentId)
    const legion = CLEAR_LEGIONS.find(({ id }) => id === contentId)
    if (content === undefined && legion === undefined) {
      throw new CharacterDetailFailure('notFound')
    }

    const { stats, populations } = await this.summaryOf(current)
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
      this.queue.run(() => this.loadContentStats(content, summary, population)),
      () => {
        current.contentStats.delete(key)
      }
    )

    current.contentStats.set(key, loading)

    return loading
  }

  private async overviewOf(
    current: ClearSnapshot,
    weekStart: string | undefined
  ): Promise<ClearOverview> {
    const { populations } = await this.summaryOf(current)
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
      this.queue.run(() => this.loadOverview(selectedWeekStart, populations)),
      () => {
        current.overviews.delete(selectedWeek)
      }
    )

    current.overviews.set(selectedWeek, loading)

    return loading
  }

  // 미리 계산은 한 항목씩 줄에 넣어, 그동안 온 요청이 남은 미리 계산 전체가 아니라 지금 도는 계산 하나만 기다리게 한다.
  private async warm(current: ClearSnapshot): Promise<void> {
    await this.summaryOf(current)

    const loads = [
      () => this.overviewOf(current, undefined),
      ...CLEAR_CONTENTS.map(
        ({ id }) =>
          () =>
            this.contentStatsOf(current, id, undefined)
      )
    ]

    for (const load of loads) {
      try {
        await load()
      } catch (error) {
        if (error instanceof ClearStatsClosed) {
          return
        }

        this.reportRefreshFailure()
      }
    }
  }

  private async readCollectedAt(): Promise<number | null> {
    const collectedAt = await this.repository.readCollectedAt()

    if (collectedAt === null) {
      return null
    }

    return collectedAt.getTime()
  }

  private refreshTo(collectedAt: number | null): ClearRefresh {
    if (this.refreshing?.snapshot.collectedAt === collectedAt) {
      return this.refreshing
    }

    const snapshot = emptySnapshot(collectedAt)
    const ready = this.warm(snapshot).then(
      () => {
        if (this.refreshing?.snapshot === snapshot) {
          this.served = snapshot
          this.refreshing = undefined
        }
      },
      (error: unknown) => {
        if (this.refreshing?.snapshot === snapshot) {
          this.refreshing = undefined
        }

        if (!(error instanceof ClearStatsClosed)) {
          this.reportRefreshFailure()
        }
      }
    )

    this.refreshing = { snapshot, ready }

    return this.refreshing
  }

  private async currentSnapshot(): Promise<ClearSnapshot> {
    const collectedAt = await this.readCollectedAt()

    if (this.served !== undefined) {
      if (this.served.collectedAt !== collectedAt) {
        this.refreshTo(collectedAt)
      }

      return this.served
    }

    if (this.refreshing?.snapshot.collectedAt === collectedAt) {
      return this.refreshing.snapshot
    }

    // 이전 결과가 없으면 미리 계산하지 않고 요청한 것만 계산한다. 더 오래된 시각의 미리 계산이 끝나도 이 결과를 덮지 않게 버린다.
    this.served = emptySnapshot(collectedAt)
    this.refreshing = undefined

    return this.served
  }
}

export const emptyClearStatsRepository: ClearStatsRepository = {
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
