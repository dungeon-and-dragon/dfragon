import type { JobRunErrorEntry, JobTrigger } from '@dfragon/database'
import type { JobDefinition } from './definition.js'

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

export type JobSchedulerPorts = {
  jobs: readonly JobDefinition[]
  report: ReportJobEvent
  alert?: SendJobAlert
}
