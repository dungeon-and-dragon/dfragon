import type { TimelineQueueCount } from '@dfragon/database'
import type { QueueRepository } from './repository.js'

export class QueueService {
  constructor(private readonly repository: QueueRepository) {}

  readCounts(): Promise<readonly TimelineQueueCount[]> {
    return this.repository.readCounts()
  }
}
