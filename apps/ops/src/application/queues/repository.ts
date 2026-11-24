import type { TimelineSyncRequestCount } from '@dfragon/database'

export interface QueueRepository {
  readCounts(): Promise<readonly TimelineSyncRequestCount[]>
}
