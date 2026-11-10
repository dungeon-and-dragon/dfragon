import type {
  ClaimedJobRun,
  InterruptedJobRun,
  JobRegistration,
  JobRunErrorEntry,
  JobRunOutcome,
  JobRunProgress,
  JobTrigger
} from '@dfragon/database'

export type JobStore = {
  registerJobs: (jobs: readonly JobRegistration[]) => Promise<void>
  interruptRunningRuns: () => Promise<InterruptedJobRun[]>
  isPaused: (name: string) => Promise<boolean>
  readLastScheduledSuccess: (name: string) => Promise<Date | undefined>
  startRun: (name: string, trigger: Exclude<JobTrigger, 'manual'>) => Promise<number | undefined>
  claimRequestedRun: (names: readonly string[]) => Promise<ClaimedJobRun | undefined>
  recordProgress: (id: number, progress: JobRunProgress) => Promise<void>
  finishRun: (id: number, outcome: JobRunOutcome) => Promise<void>
  recordNextRun: (name: string, nextRunAt: Date | null) => Promise<void>
  recordWorkerSeen: () => Promise<void>
}

export type JobEventDetails = {
  job?: string
  runId?: number
  trigger?: JobTrigger
  reason?: 'paused' | 'active'
  durationMs?: number
  errorChain?: readonly JobRunErrorEntry[]
}

export type ReportJobEvent = (code: string, details: JobEventDetails) => void

export type JobAlert = {
  kind: 'failed' | 'interrupted' | 'delayed'
  job: string
  trigger: JobTrigger
  elapsedMs: number
  errorChain?: readonly JobRunErrorEntry[]
}

export type SendJobAlert = (alert: JobAlert) => Promise<void>

export type JobSchedule = {
  nextRun: (previous?: Date) => Date | null
}

export type CreateJobSchedule = (schedule: string) => JobSchedule

export type DeleteJobRunsFinishedBefore = (before: Date) => Promise<number>
