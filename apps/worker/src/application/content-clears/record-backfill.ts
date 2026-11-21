import type { ClearRecordInput } from '@dfragon/database'
import {
  CLEAR_CONTENTS,
  toCollectionMinFame
} from '@dfragon/server-core/domain/content-clears/index.js'
import { toClearRecordInput, toClearRecordRanges } from '#domain/content-clears/index.js'
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

const characterKey = ({ serverId, characterId }: { serverId: string; characterId: string }) =>
  JSON.stringify([serverId, characterId])

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
    const collectionMinFame = toCollectionMinFame(CLEAR_CONTENTS)
    // 지금은 비활성인 캐릭터도 지난 시즌의 클리어 기록이 있으므로 비활성도 부른다.
    const selection = { minMaxFame: collectionMinFame, activity: 'include-inactive' } as const
    const characters = await this.repository.countPopulation(selection)
    const fetchedUntil = new Map(
      (await this.repository.readCursors()).map((cursor) => [
        characterKey(cursor),
        cursor.fetchedUntil
      ])
    )
    const counts = { requests: 0, records: 0 }
    const fetchTimeline = createFetchTimeline(() => {
      counts.requests++
    })

    report('CLEAR_RECORD_BACKFILL_STARTED', {
      startedAt: startedAtIso,
      done: resumedAt,
      minFame: collectionMinFame,
      characters,
      cursors: fetchedUntil.size
    })

    const skipped = await collectPopulation({
      total: characters,
      readPage: (page) => this.repository.readPopulationPage(selection, page),
      resumedAt,
      rangesOf: (character) => {
        const characterFetchedUntil = fetchedUntil.get(characterKey(character))

        return toClearRecordRanges(characterFetchedUntil, startedAt)
      },
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

        // 기록을 저장한 뒤에 받은 시각을 옮겨, 저장 도중 멈추면 다음 실행이 같은 구간을 다시 받는다.
        await this.repository.recordCursors(
          collected.map(({ character }) => character),
          startedAt
        )
        counts.records += records.length
      },
      recordProgress: (done) => this.repository.recordProgress({ startedAt, done })
    })

    await this.repository.finishProgress(startedAt)
    const summary = {
      startedAt: startedAtIso,
      characters,
      ...counts,
      skipped
    }
    report('CLEAR_RECORD_BACKFILL_DONE', summary)

    return summary
  }
}
