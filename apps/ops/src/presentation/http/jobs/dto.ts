import type { JobOverview, JobRunRecord } from '@dfragon/database'
import { z } from 'zod'
import type { JobList, JobRunPage } from '../../../application/jobs/service.js'

const DEFAULT_RUN_PAGE_SIZE = 20
const MAX_RUN_PAGE_SIZE = 100
// job_runs.id가 int4라 9자리까지만 받는다.
const POSITIVE_INT4_DIGITS = /^[1-9]\d{0,8}$/
const positiveInteger = z.string().regex(POSITIVE_INT4_DIGITS).transform(Number)

export const runPageQuery = z.object({
  before: positiveInteger.optional(),
  limit: positiveInteger.pipe(z.number().max(MAX_RUN_PAGE_SIZE)).default(DEFAULT_RUN_PAGE_SIZE)
})

export type RunPageQuery = z.infer<typeof runPageQuery>

export const runRequestBody = z.object({ args: z.unknown().optional() })

export type RunRequestBody = z.infer<typeof runRequestBody>

export type JobRunResponse = Omit<JobRunRecord, 'progressDone' | 'progressTotal'> & {
  progress: { done: number; total: number | null } | null
}

export type JobResponse = {
  name: string
  displayName: string
  description: string
  schedule: string | null
  paused: boolean
  nextRunAt: Date | null
  argsSchema: unknown
  delayMinutes: number
  activeRun: JobRunResponse | null
  lastFinishedRun: JobRunResponse | null
}

export type JobListResponse = {
  workerSeenAt: Date | null
  jobs: JobResponse[]
}

export type JobRunPageResponse = {
  runs: JobRunResponse[]
  nextBefore: number | null
}

export type JobRunRequestResponse = {
  id: number
}

function toJobRunResponse(run: JobRunRecord): JobRunResponse {
  const { progressDone, progressTotal, ...rest } = run
  const progress = progressDone !== null ? { done: progressDone, total: progressTotal } : null

  return { ...rest, progress }
}

function toJobResponse(job: JobOverview): JobResponse {
  const paused = job.pausedAt !== null
  const nextRunAt = paused ? null : job.nextRunAt
  const activeRun = job.activeRun !== null ? toJobRunResponse(job.activeRun) : null
  const lastFinishedRun =
    job.lastFinishedRun !== null ? toJobRunResponse(job.lastFinishedRun) : null

  return {
    name: job.name,
    displayName: job.displayName,
    description: job.description,
    schedule: job.schedule,
    paused,
    nextRunAt,
    argsSchema: job.argsSchema,
    delayMinutes: job.delayMinutes,
    activeRun,
    lastFinishedRun
  }
}

export function toJobListResponse({ workerSeenAt, jobs }: JobList): JobListResponse {
  const jobResponses = jobs.map(toJobResponse)

  return { workerSeenAt, jobs: jobResponses }
}

export function toJobRunPageResponse({ runs, nextBefore }: JobRunPage): JobRunPageResponse {
  const runResponses = runs.map(toJobRunResponse)

  return { runs: runResponses, nextBefore }
}

export function toJobRunRequestResponse(id: number): JobRunRequestResponse {
  return { id }
}
