import {
  type DatabaseClient,
  deleteJobRunsFinishedBefore,
  deleteWorkerEventsBefore
} from '@dfragon/database'
import type { JobRunCleanupRepository } from '#application/jobs/repository.js'

export class DatabaseJobRunCleanupRepository implements JobRunCleanupRepository {
  constructor(private readonly client: DatabaseClient) {}

  deleteJobRunsFinishedBefore(before: Date): Promise<number> {
    return deleteJobRunsFinishedBefore(this.client, before)
  }

  deleteWorkerEventsBefore(before: Date): Promise<number> {
    return deleteWorkerEventsBefore(this.client, before)
  }
}
