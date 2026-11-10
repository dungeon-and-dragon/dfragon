import { subDays } from 'date-fns'
import { z } from 'zod'
import { defineJob } from './definition.js'
import type { DeleteJobRunsFinishedBefore } from './ports.js'

const RETENTION_DAYS = 90

export function createJobRunCleanupJob(deleteJobRunsFinishedBefore: DeleteJobRunsFinishedBefore) {
  return defineJob({
    name: 'job-run-cleanup',
    displayName: '실행 이력 정리',
    description: '끝난 지 90일이 지난 실행 이력을 지웁니다.',
    schedule: '0 4 * * *',
    argsSchema: z.object({}),
    delayMinutes: 5,
    run: async () => {
      const deleted = await deleteJobRunsFinishedBefore(subDays(new Date(), RETENTION_DAYS))

      return { deleted }
    }
  })
}
