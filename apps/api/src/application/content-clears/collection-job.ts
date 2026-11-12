import { setTimeout } from 'node:timers/promises'
import { z } from 'zod'
import { defineJob } from '../jobs/definition.js'
import type { ClearCollectionJobDependencies, ClearCollectionStore } from './ports.js'
import { collectContentClears } from './collection.js'

// 최고 명성 104,292 이상 약 92만 명(2026-11-10 운영 DB)을 초당 40건으로 받으면 다른 요청 없이도 6.4시간이 걸린다.
// 새 캐릭터 저장과 Neople 요청을 나눠 보내므로 두 배 넘게 둔다.
const DELAY_MINUTES = 16 * 60

export function createContentClearCollectionJob(
  store: ClearCollectionStore,
  { createFetchTimeline, readConcurrency, report }: ClearCollectionJobDependencies
) {
  return defineJob({
    name: 'content-clear-collection',
    displayName: '클리어 기록 수집',
    description:
      '최고 명성이 종류별 최신 컨텐츠의 입장 명성 이상인 캐릭터의 클리어 기록을 Neople에서 받아 저장합니다. 다른 수집과 Neople 요청 속도 상한을 나눠 씁니다.',
    schedule: '0 6 * * *',
    argsSchema: z.object({}),
    delayMinutes: DELAY_MINUTES,
    run: (_args, { reportProgress }) =>
      collectContentClears({
        store,
        createFetchTimeline,
        readConcurrency,
        now: () => new Date(),
        pause: (ms) => setTimeout(ms),
        report,
        reportProgress
      })
  })
}
