import type { ClearRecordInput } from '@dfragon/database'
import { splitTimelineRanges } from '../../domain/character-timeline/ranges.js'
import { CLEAR_CONTENTS, toCollectionMinFame } from '../../domain/content-clears/contents.js'
import {
  CLEAR_RECORD_BACKFILL_START,
  toClearRecordInput
} from '../../domain/content-clears/records.js'
import type { ClearRecordBackfillDependencies } from './ports.js'
import { collectPopulation, readOrStartProgress } from './population-collection.js'

export type ClearRecordBackfillSummary = {
  startedAt: string
  characters: number
  requests: number
  records: number
  skipped: number
}

/**
 * 클리어 수집과 같은 대상의 지난 레이드, 레기온 기록을 시작 시각까지 받아 기록 테이블에만 저장한다.
 * 클리어 집계 테이블과 주별 분모는 쓰지 않아 마감한 주의 값이 바뀌지 않는다.
 */
export async function backfillClearRecords({
  store,
  createFetchTimeline,
  readConcurrency,
  now,
  pause,
  report,
  reportProgress
}: ClearRecordBackfillDependencies): Promise<ClearRecordBackfillSummary> {
  const { startedAt, done: resumedAt } = await readOrStartProgress(store, now)
  const startedAtIso = startedAt.toISOString()
  const ranges = splitTimelineRanges(CLEAR_RECORD_BACKFILL_START, startedAt)
  const collectionMinFame = toCollectionMinFame(CLEAR_CONTENTS)
  const population = await store.readPopulation(collectionMinFame)
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
        await store.recordRecords(records)
      }

      counts.records += records.length
    },
    recordProgress: (done) => store.recordProgress({ startedAt, done })
  })

  await store.finishProgress(startedAt)
  const summary = {
    startedAt: startedAtIso,
    characters: population.length,
    ...counts,
    skipped
  }
  report('CLEAR_RECORD_BACKFILL_DONE', summary)

  return summary
}
