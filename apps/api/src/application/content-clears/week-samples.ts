import type { StoredClearPopulation } from '@dfragon/database'
import { CLEAR_CONTENTS, type ClearContent } from '../../domain/content-clears/contents.js'
import type { ClearWeekSampleRepository } from './repository.js'
import { ClearSampleLoader } from './sample-loader.js'

export type ClearWeekSampleSummary = {
  contents: number
  overviews: number
}

type ContentWeek = {
  content: ClearContent
  population: StoredClearPopulation
}

const contentWeekKey = (contentId: string, weekStart: Date) => `${contentId}/${weekStart.getTime()}`

const newestFirst = (left: Date, right: Date) => right.getTime() - left.getTime()

// 전체 개요는 한 주의 모든 컨텐츠를 함께 보므로 그 주의 모든 모집단이 마감했을 때만 저장한다.
function closedWeekStarts(populations: readonly StoredClearPopulation[]): Date[] {
  const weeks = new Map<number, { weekStart: Date; closed: boolean }>()

  for (const { weekStart, closed } of populations) {
    const key = weekStart.getTime()
    const allClosed = (weeks.get(key)?.closed ?? true) && closed
    weeks.set(key, { weekStart, closed: allClosed })
  }

  return [...weeks.values()].filter(({ closed }) => closed).map(({ weekStart }) => weekStart)
}

// 마감한 주의 클리어 기록과 모집단은 다시 바뀌지 않아, 저장한 주는 다시 계산하지 않는다.
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
        const content = CLEAR_CONTENTS.find(({ id }) => id === population.contentId)

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

    return { contents: contentWeeks.length, overviews: overviewWeeks.length }
  }
}
