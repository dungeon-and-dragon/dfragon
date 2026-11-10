import {
  type DatabaseClient,
  claimRequestedJobRun,
  finishJobRun,
  interruptRunningJobRuns,
  isJobPaused,
  readLastScheduledJobSuccess,
  recordJobNextRun,
  recordJobRunProgress,
  recordJobWorkerSeen,
  registerJobs,
  startJobRun
} from '@dfragon/database'
import type { JobStore } from '../../application/jobs/ports.js'

export function createDatabaseJobStore(client: DatabaseClient): JobStore {
  return {
    registerJobs: (jobs) => registerJobs(client, jobs),
    interruptRunningRuns: () => interruptRunningJobRuns(client),
    isPaused: (name) => isJobPaused(client, name),
    readLastScheduledSuccess: (name) => readLastScheduledJobSuccess(client, name),
    startRun: (name, trigger) => startJobRun(client, name, trigger),
    claimRequestedRun: (names) => claimRequestedJobRun(client, names),
    recordProgress: (id, progress) => recordJobRunProgress(client, id, progress),
    finishRun: (id, outcome) => finishJobRun(client, id, outcome),
    recordNextRun: (name, nextRunAt) => recordJobNextRun(client, name, nextRunAt),
    recordWorkerSeen: () => recordJobWorkerSeen(client)
  }
}
