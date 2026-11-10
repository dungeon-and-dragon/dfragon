import { type DatabaseClient, deleteJobRunsFinishedBefore } from '@dfragon/database'
import type { DeleteJobRunsFinishedBefore } from '../../application/jobs/ports.js'

export function createDatabaseJobRunCleanup(client: DatabaseClient): DeleteJobRunsFinishedBefore {
  return (before) => deleteJobRunsFinishedBefore(client, before)
}
