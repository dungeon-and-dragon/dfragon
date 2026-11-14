import type { TimelineQueueCount } from '@dfragon/database'

export interface QueueRepository {
  readCounts(): Promise<readonly TimelineQueueCount[]>
}
