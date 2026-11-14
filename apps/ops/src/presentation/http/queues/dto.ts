import type { TimelineQueueCount } from '@dfragon/database'

export type QueueListResponse = {
  queues: readonly TimelineQueueCount[]
}

export function toQueueListResponse(queues: readonly TimelineQueueCount[]): QueueListResponse {
  return { queues }
}
