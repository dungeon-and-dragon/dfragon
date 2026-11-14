import type {
  ClaimedJobRun,
  InterruptedJobRun,
  JobRegistration,
  JobRunOutcome,
  JobRunProgress,
  JobTrigger
} from '@dfragon/database'

export interface JobRepository {
  registerJobs(jobs: readonly JobRegistration[]): Promise<void>
  interruptRunningRuns(): Promise<InterruptedJobRun[]>
  isPaused(name: string): Promise<boolean>
  readLastScheduledSuccess(name: string): Promise<Date | undefined>
  startRun(name: string, trigger: Exclude<JobTrigger, 'manual'>): Promise<number | undefined>
  claimRequestedRun(names: readonly string[]): Promise<ClaimedJobRun | undefined>
  recordProgress(id: number, progress: JobRunProgress): Promise<void>
  finishRun(id: number, outcome: JobRunOutcome): Promise<void>
  recordNextRun(name: string, nextRunAt: Date | null): Promise<void>
  recordWorkerSeen(): Promise<void>
}

export interface JobRunCleanupRepository {
  deleteJobRunsFinishedBefore(before: Date): Promise<number>
}
