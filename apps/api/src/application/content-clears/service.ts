import type { ClearFirstWeekCount, StoredClearPopulation } from '@dfragon/database'
import { CharacterDetailFailure } from '@dfragon/server-core/domain/character-failure.js'
import { formatResetDate } from '@dfragon/server-core/domain/seoul-time.js'
import {
  CLEAR_CONTENTS,
  CLEAR_LEGIONS,
  type ClearContent,
  filterClearContents
} from '@dfragon/server-core/domain/content-clears/index.js'
import {
  type ClearContentStats,
  type ClearContentSummary,
  type ClearOverview,
  type ClearStats,
  toClearContentStats,
  toClearOverview,
  toClearSummaries,
  toEmptyClearOverview,
  toEmptyContentStats
} from '#domain/content-clears/index.js'
import type { ClearStatsRepository } from '@dfragon/server-core/application/content-clears/repository.js'
import { ClearSampleLoader } from '@dfragon/server-core/application/content-clears/index.js'

type ClearSummary = {
  stats: ClearStats
  populations: StoredClearPopulation[]
}

type ClearVersion = {
  key: string
  contents: readonly ClearContent[]
  legions: readonly ClearContent[]
}

type ClearSnapshot = ClearVersion & {
  summary?: Promise<ClearSummary>
  firstWeeks: Map<string, Promise<ClearFirstWeekCount[]>>
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

function emptySnapshot(version: ClearVersion): ClearSnapshot {
  return {
    ...version,
    firstWeeks: new Map(),
    contentStats: new Map(),
    overviews: new Map()
  }
}

// 수집은 worker 프로세스가 하므로 요청마다 마지막 수집 시각을 읽는다. 바뀌었으면 새 시각의 결과를 미리 계산하고,
// 그동안은 이전 시각의 결과를 준다.
export class ClearStatsService {
  private readonly queue = createSerialQueue()
  private readonly samples: ClearSampleLoader
  private served: ClearSnapshot | undefined
  private refreshing: ClearRefresh | undefined

  constructor(
    private readonly repository: ClearStatsRepository,
    private readonly reportRefreshFailure: () => void
  ) {
    this.samples = new ClearSampleLoader(repository)
  }

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
      const version = await this.readVersion()

      if (this.served?.key !== version.key) {
        await this.refreshTo(version).ready
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

  private async loadSummary(current: ClearSnapshot): Promise<ClearSummary> {
    // 마감하지 않은 주는 다 받지 않은 값이라 보여 주지 않는다.
    const populations = (await this.repository.readPopulations()).filter(({ closed }) => closed)
    const counts = await this.repository.readWeekRatioCounts()
    const contents = toClearSummaries(current.contents, populations, counts)
    const legions = toClearSummaries(current.legions, populations, counts)
    const stats = { contents, legions }

    return { stats, populations }
  }

  private summaryOf(current: ClearSnapshot): Promise<ClearSummary> {
    current.summary ??= cacheUntilFailure(
      this.queue.run(() => this.loadSummary(current)),
      () => {
        current.summary = undefined
      }
    )

    return current.summary
  }

  private firstWeeksOf(current: ClearSnapshot, contentId: string): Promise<ClearFirstWeekCount[]> {
    const cached = current.firstWeeks.get(contentId)

    if (cached !== undefined) {
      return cached
    }

    const loading = cacheUntilFailure(this.repository.readFirstWeeks(contentId), () => {
      current.firstWeeks.delete(contentId)
    })

    current.firstWeeks.set(contentId, loading)

    return loading
  }

  // 마감한 주는 worker가 저장한 재료를 읽고, 아직 저장하지 않은 주만 직접 계산한다. 첫 클리어 주는 다음 주의
  // 클리어로도 바뀌어 저장하지 않고 수집 시각마다 컨텐츠별로 한 번 읽는다.
  private async loadContentStats(
    current: ClearSnapshot,
    content: ClearContent,
    summary: ClearContentSummary,
    population: StoredClearPopulation | undefined
  ): Promise<ClearContentStats> {
    if (population === undefined) {
      return toEmptyContentStats(summary)
    }

    const week = { contentId: content.id, weekStart: population.weekStart }
    const samples =
      (await this.repository.readContentWeekSamples(week)) ??
      (await this.samples.loadContent(content, population))
    const firstWeeks = await this.firstWeeksOf(current, content.id)

    return toClearContentStats(summary, population, { ...samples, firstWeeks })
  }

  private async loadOverview(
    current: ClearSnapshot,
    weekStart: Date,
    populations: readonly StoredClearPopulation[]
  ): Promise<ClearOverview> {
    const samples =
      (await this.repository.readOverviewSamples(weekStart)) ??
      (await this.samples.loadOverview(weekStart))

    return toClearOverview(current.contents, weekStart, populations, samples)
  }

  private async contentStatsOf(
    current: ClearSnapshot,
    contentId: string,
    weekStart: string | undefined
  ): Promise<ClearContentStats> {
    const content = [...current.contents, ...current.legions].find(({ id }) => id === contentId)
    if (content === undefined) {
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
      this.queue.run(() => this.loadContentStats(current, content, summary, population)),
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
    // 첫 레이드 전 베누스만 있던 주는 개요에 보일 레이드 집계가 없어 고를 주에서 뺀다.
    const weekStarts = new Map(
      populations
        .filter(({ contentId }) => current.contents.some(({ id }) => id === contentId))
        .map((population) => [formatResetDate(population.weekStart), population.weekStart])
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
      this.queue.run(() => this.loadOverview(current, selectedWeekStart, populations)),
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
      ...[...current.contents, ...current.legions].map(
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

  // 노출 설정은 운영 화면에서 바뀌므로 수집 시각과 함께 읽어, 둘 중 하나가 바뀌면 다시 계산한다.
  private async readVersion(): Promise<ClearVersion> {
    const collectedAt = await this.repository.readCollectedAt()
    const settings = await this.repository.readSettings()
    const contents = filterClearContents(CLEAR_CONTENTS, settings, 'shown')
    const legions = filterClearContents(CLEAR_LEGIONS, settings, 'shown')
    const shownIds = [...contents, ...legions].map(({ id }) => id)
    const key = JSON.stringify([collectedAt?.getTime() ?? null, shownIds])

    return { key, contents, legions }
  }

  private refreshTo(version: ClearVersion): ClearRefresh {
    if (this.refreshing?.snapshot.key === version.key) {
      return this.refreshing
    }

    const snapshot = emptySnapshot(version)
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
    const version = await this.readVersion()

    if (this.served !== undefined) {
      if (this.served.key !== version.key) {
        this.refreshTo(version)
      }

      return this.served
    }

    if (this.refreshing?.snapshot.key === version.key) {
      return this.refreshing.snapshot
    }

    // 이전 결과가 없으면 미리 계산하지 않고 요청한 것만 계산한다. 더 오래된 시각의 미리 계산이 끝나도 이 결과를 덮지 않게 버린다.
    this.served = emptySnapshot(version)
    this.refreshing = undefined

    return this.served
  }
}

export const emptyClearStatsRepository: ClearStatsRepository = {
  readCollectedAt: async () => null,
  readSettings: async () => [],
  readPopulations: async () => [],
  readWeekRatioCounts: async () => [],
  readContentWeekSamples: async () => null,
  readOverviewSamples: async () => null,
  readAdventureSizes: async () => [],
  readContentJobFames: async () => [],
  readContentTimes: async () => [],
  readFirstWeeks: async () => [],
  readFameBands: async () => [],
  readWeekGroups: async () => [],
  readWeekMoves: async () => [],
  readStreaks: async () => [],
  readContentJobScores: async () => [],
  readWeekGroupScores: async () => [],
  readScoreBands: async () => [],
  readScores: async () => [],
  readJobScores: async () => [],
  readFames: async () => [],
  readJobFames: async () => [],
  readRaidTimes: async () => []
}
