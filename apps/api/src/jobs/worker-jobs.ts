import type { DatabaseClient } from '@dfragon/database'
import {
  type ClearCollectionJobDependencies,
  createContentClearCollectionJob,
  createDatabaseClearCollectionStore
} from '../content-clears/collection-job.js'
import {
  createCharacterStatsJob,
  createDatabaseStatsJobStore,
  createSkillAdoptionJob
} from '../ranking-stats/stats-jobs.js'
import type { JobDefinition } from './definition.js'
import { createJobRunCleanupJob } from './job-run-cleanup.js'

export function createWorkerJobs(
  client: DatabaseClient,
  clearCollection: ClearCollectionJobDependencies
): JobDefinition[] {
  const statsStore = createDatabaseStatsJobStore(client)

  return [
    createJobRunCleanupJob(client),
    createContentClearCollectionJob(createDatabaseClearCollectionStore(client), clearCollection),
    createCharacterStatsJob(statsStore),
    createSkillAdoptionJob(statsStore)
  ]
}
