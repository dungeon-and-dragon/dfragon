import type { DatabaseClient } from '@dfragon/database'
import {
  type ClearCollectionJobDependencies,
  createContentClearCollectionJob,
  createDatabaseClearCollectionStore
} from '../content-clears/collection-job.js'
import {
  type SkillStyleCollectionJobDependencies,
  createDatabaseSkillStyleCollectionStore,
  createSkillStyleCollectionJob
} from '../ranking-stats/skill-style-collection.js'
import {
  createCharacterStatsJob,
  createDatabaseStatsJobStore,
  createSkillAdoptionJob
} from '../ranking-stats/stats-jobs.js'
import type { JobDefinition } from './definition.js'
import { createJobRunCleanupJob } from './job-run-cleanup.js'

export type WorkerJobDependencies = ClearCollectionJobDependencies &
  SkillStyleCollectionJobDependencies

export function createWorkerJobs(
  client: DatabaseClient,
  collection: WorkerJobDependencies
): JobDefinition[] {
  const statsStore = createDatabaseStatsJobStore(client)

  return [
    createJobRunCleanupJob(client),
    createContentClearCollectionJob(createDatabaseClearCollectionStore(client), collection),
    createSkillStyleCollectionJob(createDatabaseSkillStyleCollectionStore(client), collection),
    createCharacterStatsJob(statsStore),
    createSkillAdoptionJob(statsStore)
  ]
}
