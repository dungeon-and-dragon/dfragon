import type { CharacterActivityInput, ClearRecordInput, ContentClearInput } from '@dfragon/database'
import {
  CLEAR_CONTENTS,
  toCollectionMinFame,
  toContentClearInput,
  toPopulationMinFame
} from '@dfragon/server-core/domain/content-clears/index.js'
import {
  planClearCollection,
  toRequestActivity,
  weekKey,
  toClearRecordInput
} from '#domain/content-clears/index.js'
import { latestRecentActivity } from '#domain/character-activity/index.js'
import type { ClearCollectionPorts } from './ports.js'
import { collectPopulation, readOrStartProgress } from './population-collection.js'
import type { ClearCollectionRepository } from './repository.js'

export type ClearCollectionSummary = {
  startedAt: string
  characters: number
  requests: number
  clears: number
  records: number
  skipped: number
}

export class ContentClearCollectionService {
  constructor(
    private readonly repository: ClearCollectionRepository,
    private readonly ports: ClearCollectionPorts
  ) {}

  /**
   * 진행 위치를 캐릭터 묶음마다 저장해, 도중에 끝난 수집은 다음 실행이 같은 시작 시각의 구간으로 남은 캐릭터부터 이어 받는다.
   * 모집단은 클리어 기록을 다 저장한 뒤 저장한다. 조회는 모집단의 수집 시각이 바뀔 때 집계를 다시 읽는다.
   */
  async collect(
    reportProgress: (done: number, total: number) => void
  ): Promise<ClearCollectionSummary> {
    const { createFetchTimeline, readConcurrency, now, pause, report } = this.ports
    const { startedAt, done: resumedAt } = await readOrStartProgress(this.repository, now)
    const plan = planClearCollection(
      CLEAR_CONTENTS,
      await this.repository.readPopulations(),
      startedAt
    )
    const plannedWeeks = new Set(
      plan.weeks.map(({ contentId, weekStart }) => weekKey(contentId, weekStart))
    )
    const collectionMinFame = toCollectionMinFame(CLEAR_CONTENTS)
    // 분모는 비활성을 포함한 모집단 전체로 두고, 최근 구간만 받을 때는 요청을 활성 캐릭터에만 보낸다.
    // 다시 접속한 비활성 캐릭터의 클리어는 활동이 다시 기록될 때까지 빠지는 대신 매주 요청이 줄어든다.
    const population = await this.repository.countPopulation({
      minMaxFame: collectionMinFame,
      activity: 'include-inactive'
    })
    const requested = {
      minMaxFame: collectionMinFame,
      activity: toRequestActivity(plan, startedAt)
    }
    const characters = await this.repository.countPopulation(requested)
    const counts = { requests: 0, clears: 0, records: 0 }
    const fetchTimeline = createFetchTimeline(() => {
      counts.requests++
    })

    report('CONTENT_CLEAR_COLLECTION_STARTED', {
      startedAt: startedAt.toISOString(),
      done: resumedAt,
      minFame: collectionMinFame,
      characters,
      population,
      ranges: plan.ranges.length
    })

    const skipped = await collectPopulation({
      total: characters,
      readPage: (page) => this.repository.readPopulationPage(requested, page),
      resumedAt,
      rangesOf: () => plan.ranges,
      fetchTimeline,
      readConcurrency,
      pause,
      report,
      reportProgress,
      events: {
        unavailable: 'CONTENT_CLEAR_NEOPLE_UNAVAILABLE',
        skipped: 'CONTENT_CLEAR_CHARACTER_SKIPPED'
      },
      recordGroup: async (collected) => {
        const clears: ContentClearInput[] = []
        const records: ClearRecordInput[] = []
        const activities: CharacterActivityInput[] = []
        const checkedAt = now()

        for (const { character, rows } of collected) {
          const lastActiveAt = latestRecentActivity(rows, checkedAt)

          if (lastActiveAt !== undefined) {
            const { serverId, characterId } = character
            activities.push({ serverId, characterId, lastActiveAt })
          }

          for (const row of rows) {
            const clear = toContentClearInput(character, row)
            if (
              clear !== undefined &&
              plannedWeeks.has(weekKey(clear.contentId, clear.weekStart))
            ) {
              clears.push(clear)
            }

            const record = toClearRecordInput(character, row)
            if (record !== undefined) {
              records.push(record)
            }
          }
        }

        if (clears.length > 0) {
          await this.repository.recordClears(clears)
        }

        if (records.length > 0) {
          await this.repository.recordRecords(records)
        }

        if (activities.length > 0) {
          await this.repository.recordActivities(activities)
        }

        counts.clears += clears.length
        counts.records += records.length
      },
      recordProgress: (done) => this.repository.recordProgress({ startedAt, done })
    })

    const collectedAt = now()
    for (const content of CLEAR_CONTENTS) {
      const minFame = toPopulationMinFame(content, collectionMinFame)
      const jobs = await this.repository.readPopulationJobs(minFame)
      const members = jobs.reduce((sum, { count }) => sum + count, 0)
      for (const week of plan.weeks.filter(({ contentId }) => contentId === content.id)) {
        await this.repository.recordPopulation({
          ...week,
          population: members,
          minFame,
          jobs,
          collectedAt,
          closed: true
        })
      }
    }
    await this.repository.finishProgress(startedAt)
    const startedAtIso = startedAt.toISOString()
    const summary = {
      startedAt: startedAtIso,
      characters,
      ...counts,
      skipped
    }
    report('CONTENT_CLEAR_COLLECTION_DONE', summary)

    return summary
  }
}
