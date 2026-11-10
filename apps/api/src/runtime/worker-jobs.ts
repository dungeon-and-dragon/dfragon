import type { DatabaseClient } from '@dfragon/database'
import { type ClearCollectionJobDependencies } from '../application/content-clears/ports.js'
import { createContentClearCollectionJob } from '../application/content-clears/collection-job.js'
import { createDatabaseClearCollectionStore } from '../infrastructure/database/content-clear-collection.js'
import { type SkillStyleCollectionJobDependencies } from '../application/ranking-stats/ports.js'
import { createDatabaseSkillStyleCollectionStore } from '../infrastructure/database/skill-style-collection.js'
import { createSkillStyleCollectionJob } from '../application/ranking-stats/skill-style-collection.js'
import {
  createCharacterStatsJob,
  createSkillAdoptionJob
} from '../application/ranking-stats/stats-jobs.js'
import { createDatabaseStatsJobStore } from '../infrastructure/database/stats-jobs.js'
import type { JobDefinition } from '../application/jobs/definition.js'
import { createDatabaseJobRunCleanup } from '../infrastructure/database/job-run-cleanup.js'
import { createJobRunCleanupJob } from '../application/jobs/job-run-cleanup.js'

export type WorkerJobDependencies = ClearCollectionJobDependencies &
  SkillStyleCollectionJobDependencies

export function createWorkerJobs(
  client: DatabaseClient,
  collection: WorkerJobDependencies
): JobDefinition[] {
  const statsStore = createDatabaseStatsJobStore(client)

  return [
    createJobRunCleanupJob(createDatabaseJobRunCleanup(client)),
    createContentClearCollectionJob(createDatabaseClearCollectionStore(client), collection),
    createSkillStyleCollectionJob(createDatabaseSkillStyleCollectionStore(client), collection),
    createCharacterStatsJob(statsStore),
    createSkillAdoptionJob(statsStore)
  ]
}
