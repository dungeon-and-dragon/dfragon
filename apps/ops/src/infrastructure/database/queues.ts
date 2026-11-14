import {
  type DatabaseClient,
  type TimelineQueueCount,
  readTimelineQueueCounts
} from '@dfragon/database'
import type { QueueRepository } from '../../application/queues/repository.js'

export class DatabaseQueueRepository implements QueueRepository {
  constructor(private readonly client: DatabaseClient) {}

  readCounts(): Promise<TimelineQueueCount[]> {
    return readTimelineQueueCounts(this.client)
  }
}
