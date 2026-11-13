import type { ClearRecordInput, ContentClearInput } from '@dfragon/database'
import {
  CLEAR_CONTENTS,
  toCollectionMinFame,
  toContentClearInput
} from '../../domain/content-clears/contents.js'
import {
  planClearCollection,
  toContentPopulation,
  weekKey
} from '../../domain/content-clears/collection.js'
import { toClearRecordInput } from '../../domain/content-clears/records.js'
import type { ClearCollectionDependencies } from './ports.js'
import { collectPopulation, readOrStartProgress } from './population-collection.js'

export type ClearCollectionSummary = {
  startedAt: string
  characters: number
  requests: number
  clears: number
  records: number
  skipped: number
}

/**
 * 진행 위치를 캐릭터 묶음마다 저장해, 도중에 끝난 수집은 다음 실행이 같은 시작 시각의 구간으로 남은 캐릭터부터 이어 받는다.
 * 모집단은 클리어 기록을 다 저장한 뒤 저장한다. 조회는 모집단의 수집 시각이 바뀔 때 집계를 다시 읽는다.
 */
export async function collectContentClears({
  store,
  createFetchTimeline,
  readConcurrency,
  now,
  pause,
  report,
  reportProgress
}: ClearCollectionDependencies): Promise<ClearCollectionSummary> {
  const { startedAt, done: resumedAt } = await readOrStartProgress(store, now)
  const plan = planClearCollection(CLEAR_CONTENTS, await store.readPopulations(), startedAt)
  const plannedWeeks = new Set(
    plan.weeks.map(({ contentId, weekStart }) => weekKey(contentId, weekStart))
  )
  const collectionMinFame = toCollectionMinFame(CLEAR_CONTENTS)
  const population = await store.readPopulation(collectionMinFame)
  const counts = { requests: 0, clears: 0, records: 0 }
  const fetchTimeline = createFetchTimeline(() => {
    counts.requests++
  })

  report('CONTENT_CLEAR_COLLECTION_STARTED', {
    startedAt: startedAt.toISOString(),
    done: resumedAt,
    minFame: collectionMinFame,
    characters: population.length,
    ranges: plan.ranges.length
  })

  const skipped = await collectPopulation({
    population,
    resumedAt,
    ranges: plan.ranges,
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

      for (const { character, rows } of collected) {
        for (const row of rows) {
          const clear = toContentClearInput(character, row)
          if (clear !== undefined && plannedWeeks.has(weekKey(clear.contentId, clear.weekStart))) {
            clears.push(clear)
          }

          const record = toClearRecordInput(character, row)
          if (record !== undefined) {
            records.push(record)
          }
        }
      }

      if (clears.length > 0) {
        await store.recordClears(clears)
      }

      if (records.length > 0) {
        await store.recordRecords(records)
      }

      counts.clears += clears.length
      counts.records += records.length
    },
    recordProgress: (done) => store.recordProgress({ startedAt, done })
  })

  const collectedAt = now()
  for (const content of CLEAR_CONTENTS) {
    const contentPopulation = toContentPopulation(content, population, collectionMinFame)
    for (const week of plan.weeks.filter(({ contentId }) => contentId === content.id)) {
      await store.recordPopulation({ ...week, ...contentPopulation, collectedAt })
    }
  }
  await store.finishProgress(startedAt)
  const startedAtIso = startedAt.toISOString()
  const summary = {
    startedAt: startedAtIso,
    characters: population.length,
    ...counts,
    skipped
  }
  report('CONTENT_CLEAR_COLLECTION_DONE', summary)

  return summary
}
