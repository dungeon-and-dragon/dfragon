import type { DatabaseClient } from '@dfragon/database'
import type { JobDefinition } from './definition.js'
import { createJobRunCleanupJob } from './job-run-cleanup.js'

export function createWorkerJobs(client: DatabaseClient): JobDefinition[] {
  return [createJobRunCleanupJob(client)]
}
