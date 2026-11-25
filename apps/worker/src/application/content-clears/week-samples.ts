import type { ClearPopulationJob, StoredClearPopulation } from '@dfragon/database'
import {
  CLEAR_CONTENTS,
  CLEAR_LEGIONS,
  toCollectionMinFame,
  toPopulationMinFame,
  type ClearContent
} from '@dfragon/server-core/domain/content-clears/index.js'
import type { ClearWeekSampleRepository } from '@dfragon/server-core/application/content-clears/repository.js'
import { ClearSampleLoader } from '@dfragon/server-core/application/content-clears/index.js'
import { planLegionClearMoves } from '#domain/content-clears/index.js'

export type ClearWeekSampleSummary = {
  legions: number
  contents: number
  overviews: number
}

const SAMPLED_CONTENTS: readonly ClearContent[] = [...CLEAR_CONTENTS, ...CLEAR_LEGIONS]

type ContentWeek = {
  content: ClearContent
  population: StoredClearPopulation
}

const contentWeekKey = (contentId: string, weekStart: Date) => `${contentId}/${weekStart.getTime()}`

const newestFirst = (left: Date, right: Date) => right.getTime() - left.getTime()

// 전체 개요는 한 주의 모든 컨텐츠를 함께 보므로 그 주의 모든 분모가 마감했을 때만 저장한다.
// 첫 레이드 전 베누스만 있던 주는 개요에 보일 레이드 집계가 없어 저장하지 않는다.
function closedWeekStarts(populations: readonly StoredClearPopulation[]): Date[] {
  const weeks = new Map<number, { weekStart: Date; closed: boolean; hasRaid: boolean }>()

  for (const { contentId, weekStart, closed } of populations) {
    const key = weekStart.getTime()
    const week = weeks.get(key)
    const allClosed = (week?.closed ?? true) && closed
    const hasRaid = (week?.hasRaid ?? false) || CLEAR_CONTENTS.some(({ id }) => id === contentId)
    weeks.set(key, { weekStart, closed: allClosed, hasRaid })
  }

  return [...weeks.values()]
    .filter(({ closed, hasRaid }) => closed && hasRaid)
    .map(({ weekStart }) => weekStart)
}

// 마감한 주의 클리어 기록과 분모는 다시 바뀌지 않아, 저장한 주는 다시 계산하지 않는다.
export class ClearWeekSampleService {
  private readonly samples: ClearSampleLoader

  constructor(
    private readonly repository: ClearWeekSampleRepository,
    private readonly now: () => Date = () => new Date()
  ) {
    this.samples = new ClearSampleLoader(repository)
  }

  async recordMissing(
    reportProgress: (done: number, total: number) => void
  ): Promise<ClearWeekSampleSummary> {
    const legions = await this.moveLegionClears()
    const populations = await this.repository.readPopulations()
    const storedContentWeeks = new Set(
      (await this.repository.readContentWeekSampleWeeks()).map(({ contentId, weekStart }) =>
        contentWeekKey(contentId, weekStart)
      )
    )
    const storedOverviewWeeks = new Set(
      (await this.repository.readOverviewSampleWeeks()).map((weekStart) => weekStart.getTime())
    )

    const contentWeeks = populations
      .filter(({ closed }) => closed)
      .filter(
        ({ contentId, weekStart }) => !storedContentWeeks.has(contentWeekKey(contentId, weekStart))
      )
      .flatMap((population): ContentWeek[] => {
        const content = SAMPLED_CONTENTS.find(({ id }) => id === population.contentId)

        if (content === undefined) {
          return []
        }

        return [{ content, population }]
      })
      .sort((left, right) => newestFirst(left.population.weekStart, right.population.weekStart))
    const overviewWeeks = closedWeekStarts(populations)
      .filter((weekStart) => !storedOverviewWeeks.has(weekStart.getTime()))
      .sort(newestFirst)

    const total = contentWeeks.length + overviewWeeks.length
    let done = 0

    reportProgress(done, total)

    if (total > 0) {
      await this.repository.analyzeContentClears()
    }

    for (const { content, population } of contentWeeks) {
      const samples = await this.samples.loadContent(content, population)
      const week = { contentId: content.id, weekStart: population.weekStart }

      await this.repository.recordContentWeekSamples(week, samples, this.now())
      done += 1
      reportProgress(done, total)
    }

    for (const weekStart of overviewWeeks) {
      const samples = await this.samples.loadOverview(weekStart)

      await this.repository.recordOverviewSamples(weekStart, samples, this.now())
      done += 1
      reportProgress(done, total)
    }

    return { legions, contents: contentWeeks.length, overviews: overviewWeeks.length }
  }

  // 레기온 클리어를 먼저 옮기고 분모를 마감해야 아래 상세 집계가 그 주를 계산한다.
  private async moveLegionClears(): Promise<number> {
    const populations = await this.repository.readPopulations()
    const moves = planLegionClearMoves(CLEAR_LEGIONS, populations, this.now())
    const collectionMinFame = toCollectionMinFame(CLEAR_CONTENTS)
    const jobsByMinFame = new Map<number, ClearPopulationJob[]>()

    for (const { legion, weekStart, copySnapshot } of moves) {
      const minFame = toPopulationMinFame(legion, collectionMinFame)
      const jobs = jobsByMinFame.get(minFame) ?? (await this.repository.readPopulationJobs(minFame))
      jobsByMinFame.set(minFame, jobs)

      await this.repository.recordLegionClears({
        contentId: legion.id,
        name: legion.name,
        weekStart,
        copySnapshot
      })

      const population = jobs.reduce((sum, { count }) => sum + count, 0)
      const collectedAt = this.now()
      await this.repository.recordPopulation({
        contentId: legion.id,
        weekStart,
        population,
        minFame,
        jobs,
        collectedAt,
        closed: true
      })
    }

    return moves.length
  }
}
