import type { DatabaseClient } from '@dfragon/database'
import {
  type ClearCollectionJobDependencies,
  createContentClearCollectionJob,
  createDatabaseClearCollectionStore
} from '../content-clears/collection-job.js'
import type { JobDefinition } from './definition.js'
import { createJobRunCleanupJob } from './job-run-cleanup.js'

export function createWorkerJobs(
  client: DatabaseClient,
  clearCollection: ClearCollectionJobDependencies
): JobDefinition[] {
  return [
    createJobRunCleanupJob(client),
    createContentClearCollectionJob(createDatabaseClearCollectionStore(client), clearCollection)
  ]
}
