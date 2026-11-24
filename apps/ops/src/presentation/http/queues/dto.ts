import type { TimelineSyncRequestCount, TimelineSyncRequestKind } from '@dfragon/database'

// 운영 화면이 API의 메모리 queue 때부터 쓰던 이름이라, 요청 종류를 그 이름으로 내보낸다.
const QUEUE_NAMES = {
  sync: 'timeline-sync',
  'enhancement-backfill': 'enhancement-backfill',
  'season-backfill': 'season-backfill'
} as const satisfies Record<TimelineSyncRequestKind, string>

export type QueueCountResponse = {
  name: (typeof QUEUE_NAMES)[TimelineSyncRequestKind]
  waiting: number
  running: number
}

export type QueueListResponse = {
  queues: readonly QueueCountResponse[]
}

export function toQueueListResponse(
  counts: readonly TimelineSyncRequestCount[]
): QueueListResponse {
  const queues = counts.map(({ kind, waiting, running }) => ({
    name: QUEUE_NAMES[kind],
    waiting,
    running
  }))

  return { queues }
}
