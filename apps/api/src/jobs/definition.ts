import type {
  ClaimedJobRun,
  InterruptedJobRun,
  JobRegistration,
  JobRunErrorEntry,
  JobRunOutcome,
  JobRunProgress,
  JobRunSummary,
  JobTrigger
} from '@dfragon/database'
import type { z } from 'zod'

export type JobContext = {
  reportProgress: (done: number, total?: number) => void
}

export type JobDefinition<Schema extends z.ZodType = z.ZodType> = {
  name: string
  displayName: string
  description: string
  /** Asia/Seoul 기준 cron 식이다. 없으면 수동으로만 돈다. */
  schedule?: string
  argsSchema: Schema
  delayMinutes: number
  run(args: z.output<Schema>, context: JobContext): Promise<JobRunSummary | undefined>
}

export function defineJob<Schema extends z.ZodType>(
  definition: JobDefinition<Schema>
): JobDefinition<Schema> {
  return definition
}

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
