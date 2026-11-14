import { type DatabaseClient, deleteJobRunsFinishedBefore } from '@dfragon/database'
import type { JobRunCleanupRepository } from '../../application/jobs/repository.js'

export class DatabaseJobRunCleanupRepository implements JobRunCleanupRepository {
  constructor(private readonly client: DatabaseClient) {}

  deleteJobRunsFinishedBefore(before: Date): Promise<number> {
    return deleteJobRunsFinishedBefore(this.client, before)
  }
}
