import {
  type DatabaseClient,
  type TimelineSyncRequestCount,
  countTimelineSyncRequests
} from '@dfragon/database'
import type { QueueRepository } from '#application/queues/repository.js'

export class DatabaseQueueRepository implements QueueRepository {
  constructor(private readonly client: DatabaseClient) {}

  readCounts(): Promise<TimelineSyncRequestCount[]> {
    return countTimelineSyncRequests(this.client)
  }
}
