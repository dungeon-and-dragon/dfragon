import type { TimelineSyncRequestCount } from '@dfragon/database'
import type { QueueRepository } from './repository.js'

export class QueueService {
  constructor(private readonly repository: QueueRepository) {}

  readCounts(): Promise<readonly TimelineSyncRequestCount[]> {
    return this.repository.readCounts()
  }
}
