import { type DatabaseClient, deleteJobRunsFinishedBefore } from '@dfragon/database'
import { subDays } from 'date-fns'
import { z } from 'zod'
import { defineJob } from './definition.js'

const RETENTION_DAYS = 90

export function createJobRunCleanupJob(client: DatabaseClient) {
  return defineJob({
    name: 'job-run-cleanup',
    displayName: '실행 이력 정리',
    schedule: '0 4 * * *',
    argsSchema: z.object({}),
    delayMinutes: 5,
    run: async () => {
      const deleted = await deleteJobRunsFinishedBefore(client, subDays(new Date(), RETENTION_DAYS))

      return { deleted }
    }
  })
}
