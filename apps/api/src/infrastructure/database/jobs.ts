import {
  type ClaimedJobRun,
  type DatabaseClient,
  type InterruptedJobRun,
  type JobRegistration,
  type JobRunOutcome,
  type JobRunProgress,
  type JobTrigger,
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
import type { JobRepository } from '../../application/jobs/repository.js'

export class DatabaseJobRepository implements JobRepository {
  constructor(private readonly client: DatabaseClient) {}

  registerJobs(jobs: readonly JobRegistration[]): Promise<void> {
    return registerJobs(this.client, jobs)
  }

  interruptRunningRuns(): Promise<InterruptedJobRun[]> {
    return interruptRunningJobRuns(this.client)
  }

  isPaused(name: string): Promise<boolean> {
    return isJobPaused(this.client, name)
  }

  readLastScheduledSuccess(name: string): Promise<Date | undefined> {
    return readLastScheduledJobSuccess(this.client, name)
  }

  startRun(name: string, trigger: Exclude<JobTrigger, 'manual'>): Promise<number | undefined> {
    return startJobRun(this.client, name, trigger)
  }

  claimRequestedRun(names: readonly string[]): Promise<ClaimedJobRun | undefined> {
    return claimRequestedJobRun(this.client, names)
  }

  recordProgress(id: number, progress: JobRunProgress): Promise<void> {
    return recordJobRunProgress(this.client, id, progress)
  }

  finishRun(id: number, outcome: JobRunOutcome): Promise<void> {
    return finishJobRun(this.client, id, outcome)
  }

  recordNextRun(name: string, nextRunAt: Date | null): Promise<void> {
    return recordJobNextRun(this.client, name, nextRunAt)
  }

  recordWorkerSeen(): Promise<void> {
    return recordJobWorkerSeen(this.client)
  }
}
