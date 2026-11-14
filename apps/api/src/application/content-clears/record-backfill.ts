import type { ClearRecordInput } from '@dfragon/database'
import { splitTimelineRanges } from '../../domain/character-timeline/ranges.js'
import { CLEAR_CONTENTS, toCollectionMinFame } from '../../domain/content-clears/contents.js'
import {
  CLEAR_RECORD_BACKFILL_START,
  toClearRecordInput
} from '../../domain/content-clears/records.js'
import type { ClearCollectionPorts } from './ports.js'
import { collectPopulation, readOrStartProgress } from './population-collection.js'
import type { ClearRecordBackfillRepository } from './repository.js'

export type ClearRecordBackfillSummary = {
  startedAt: string
  characters: number
  requests: number
  records: number
  skipped: number
}

export class ClearRecordBackfillService {
  constructor(
    private readonly repository: ClearRecordBackfillRepository,
    private readonly ports: ClearCollectionPorts
  ) {}

  /**
   * 클리어 수집과 같은 대상의 지난 레이드, 레기온 기록을 시작 시각까지 받아 기록 테이블에만 저장한다.
   * 클리어 집계 테이블과 주별 분모는 쓰지 않아 마감한 주의 값이 바뀌지 않는다.
   */
  async backfill(
    reportProgress: (done: number, total: number) => void
  ): Promise<ClearRecordBackfillSummary> {
    const { createFetchTimeline, readConcurrency, now, pause, report } = this.ports
    const { startedAt, done: resumedAt } = await readOrStartProgress(this.repository, now)
    const startedAtIso = startedAt.toISOString()
    const ranges = splitTimelineRanges(CLEAR_RECORD_BACKFILL_START, startedAt)
    const collectionMinFame = toCollectionMinFame(CLEAR_CONTENTS)
    const population = await this.repository.readPopulation(collectionMinFame)
    const counts = { requests: 0, records: 0 }
    const fetchTimeline = createFetchTimeline(() => {
      counts.requests++
    })

    report('CLEAR_RECORD_BACKFILL_STARTED', {
      startedAt: startedAtIso,
      done: resumedAt,
      minFame: collectionMinFame,
      characters: population.length,
      ranges: ranges.length
    })

    const skipped = await collectPopulation({
      population,
      resumedAt,
      ranges,
      fetchTimeline,
      readConcurrency,
      pause,
      report,
      reportProgress,
      events: {
        unavailable: 'CLEAR_RECORD_BACKFILL_NEOPLE_UNAVAILABLE',
        skipped: 'CLEAR_RECORD_BACKFILL_CHARACTER_SKIPPED'
      },
      recordGroup: async (collected) => {
        const records: ClearRecordInput[] = []

        for (const { character, rows } of collected) {
          for (const row of rows) {
            const record = toClearRecordInput(character, row)
            if (record !== undefined) {
              records.push(record)
            }
          }
        }

        if (records.length > 0) {
          await this.repository.recordRecords(records)
        }

        counts.records += records.length
      },
      recordProgress: (done) => this.repository.recordProgress({ startedAt, done })
    })

    await this.repository.finishProgress(startedAt)
    const summary = {
      startedAt: startedAtIso,
      characters: population.length,
      ...counts,
      skipped
    }
    report('CLEAR_RECORD_BACKFILL_DONE', summary)

    return summary
  }
}
