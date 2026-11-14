import { z } from 'zod'
import { defineJob } from '../jobs/definition.js'
import type { ContentClearCollectionService } from './collection.js'
import type { ClearRecordBackfillService } from './record-backfill.js'

// 최고 명성 104,292 이상 약 92만 명(2026-11-10 운영 DB)을 초당 40건으로 받으면 다른 요청 없이도 6.4시간이 걸린다.
// 새 캐릭터 저장과 Neople 요청을 나눠 보내므로 두 배 넘게 둔다.
const DELAY_MINUTES = 16 * 60

export function createContentClearCollectionJob(service: ContentClearCollectionService) {
  return defineJob({
    name: 'content-clear-collection',
    displayName: '클리어 기록 수집',
    description:
      '최고 명성이 종류별 최신 컨텐츠의 입장 명성 이상인 캐릭터의 클리어 기록을 Neople에서 받아 저장합니다. 다른 수집과 Neople 요청 속도 상한을 나눠 씁니다.',
    schedule: '0 6 * * *',
    argsSchema: z.object({}),
    delayMinutes: DELAY_MINUTES,
    run: (_args, { reportProgress }) => service.collect(reportProgress)
  })
}

// 2025-02-06부터 89일 구간 8개를 약 92만 명에게 받으면 약 740만 요청(#1593 추정)이라 초당 40건으로 51시간이 걸린다.
// 매일 수집과 Neople 요청 속도 상한을 나눠 쓰므로 두 배 넘게 둔다.
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
