import { z } from 'zod'
import { defineJob } from '../jobs/definition.js'
import type { ContentClearCollectionService } from './collection.js'
import type { ClearRecordBackfillService } from './record-backfill.js'
import type { ClearWeekSampleService } from './week-samples.js'

// 최고 명성 104,292 이상 약 92만 명(2026-11-10 운영 DB)을 초당 40건으로 받으면 다른 요청 없이도 6.4시간이 걸린다.
// 새 캐릭터 저장과 Neople 요청을 나눠 보내므로 두 배 넘게 둔다.
const DELAY_MINUTES = 16 * 60

export function createContentClearCollectionJob(service: ContentClearCollectionService) {
  return defineJob({
    name: 'content-clear-collection',
    displayName: '클리어 기록 수집',
    description:
      '최고 명성이 종류별 최신 컨텐츠의 입장 명성 이상인 캐릭터의 클리어 기록을 Neople에서 받아 저장합니다. 다른 수집과 Neople 요청 속도 상한을 나눠 씁니다.',
    // 던파의 한 주는 목요일 06:00(KST)에 끝나므로, 끝난 주를 그때 한 번 받는다.
    schedule: '0 6 * * 4',
    argsSchema: z.object({}),
    delayMinutes: DELAY_MINUTES,
    run: (_args, { reportProgress }) => service.collect(reportProgress)
  })
}

// 2025-02-06부터 89일 구간 8개를 약 92만 명에게 받으면 약 740만 요청(#1593 추정)이라 초당 40건으로 51시간이 걸린다.
// 클리어 기록 수집과 Neople 요청 속도 상한을 나눠 쓰므로 두 배 넘게 둔다.
const BACKFILL_DELAY_MINUTES = 5 * 24 * 60

export function createClearRecordBackfillJob(service: ClearRecordBackfillService) {
  return defineJob({
    name: 'clear-record-backfill',
    displayName: '지난 클리어 기록 받기',
    description:
      '클리어 기록 수집과 같은 대상 캐릭터의 2025-02-06부터의 레이드, 레기온 클리어 기록을 Neople에서 받아 저장합니다. 클리어 집계 값은 바꾸지 않고, 끊긴 실행은 다음 실행이 남은 캐릭터부터 잇습니다.',
    argsSchema: z.object({}),
    delayMinutes: BACKFILL_DELAY_MINUTES,
    run: (_args, { reportProgress }) => service.backfill(reportProgress)
  })
}

// 운영 DB에서 지난 주 컨텐츠 하나를 계산하는 쿼리는 하나에 2~7초, 모두 합쳐 약 40초다(2026-11-14). 처음 실행은
// 마감한 주 약 360개와 전체 개요 약 80주를 계산해 4~5시간으로 보고 두 배 가까이 둔다.
const WEEK_SAMPLE_DELAY_MINUTES = 8 * 60

export function createClearWeekSampleJob(service: ClearWeekSampleService) {
  return defineJob({
    name: 'clear-week-samples',
    displayName: '마감한 주 클리어 집계',
    description:
      '마감한 주마다 클리어 상세와 전체 개요에 쓰는 집계를 한 번 계산해 저장합니다. 저장한 주는 다시 계산하지 않습니다.',
    // 클리어 기록 수집은 끝나는 시각이 일정하지 않아, 매시간 저장하지 않은 마감한 주가 있는지 본다.
    schedule: '30 * * * *',
    catchup: false,
    argsSchema: z.object({}),
    delayMinutes: WEEK_SAMPLE_DELAY_MINUTES,
    run: (_args, { reportProgress }) => service.recordMissing(reportProgress)
  })
}
