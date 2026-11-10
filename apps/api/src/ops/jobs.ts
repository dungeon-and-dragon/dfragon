import type { JobOverview, JobPauseChange, JobRunRecord, JobRunRequest } from '@dfragon/database'
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common'
import { z } from 'zod'
import { OpsFailure } from './errors.js'

export const OPS_JOB_STORE = Symbol('OPS_JOB_STORE')

const DEFAULT_RUN_PAGE_SIZE = 20
const MAX_RUN_PAGE_SIZE = 100
// job_runs.id가 int4라 9자리까지만 받는다.
const POSITIVE_INT4_DIGITS = /^[1-9]\d{0,8}$/
const positiveInteger = z.string().regex(POSITIVE_INT4_DIGITS).transform(Number)

const runPageQuery = z.object({
  before: positiveInteger.optional(),
  limit: positiveInteger.pipe(z.number().max(MAX_RUN_PAGE_SIZE)).default(DEFAULT_RUN_PAGE_SIZE)
})

const runRequestBody = z.object({ args: z.unknown().optional() })

export type OpsJobStore = {
  readOverviews: () => Promise<JobOverview[]>
  readRuns: (
    name: string,
    page: { before: number | undefined; limit: number }
  ) => Promise<JobRunRecord[] | undefined>
  requestRun: (name: string, args: unknown) => Promise<JobRunRequest>
  setPaused: (name: string, paused: boolean) => Promise<JobPauseChange>
}

function runResponse(run: JobRunRecord) {
  const { progressDone, progressTotal, ...rest } = run
  const progress = progressDone !== null ? { done: progressDone, total: progressTotal } : null

  return { ...rest, progress }
}

function jobResponse(job: JobOverview) {
  const paused = job.pausedAt !== null
  const nextRunAt = paused ? null : job.nextRunAt
  const activeRun = job.activeRun !== null ? runResponse(job.activeRun) : null
  const lastFinishedRun = job.lastFinishedRun !== null ? runResponse(job.lastFinishedRun) : null

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

function latestWorkerSeenAt(jobs: readonly JobOverview[]): Date | null {
  let latest: Date | null = null
  for (const { workerSeenAt } of jobs) {
    if (latest === null || workerSeenAt > latest) {
      latest = workerSeenAt
    }
  }

  return latest
}

function throwPauseFailure(change: JobPauseChange): void {
  if (change === 'not-found') {
    throw new OpsFailure('jobNotFound')
  }

  if (change === 'not-scheduled') {
    throw new OpsFailure('jobNotScheduled')
  }
}

@Controller('api/jobs')
export class OpsJobsController {
  constructor(@Inject(OPS_JOB_STORE) private readonly store: OpsJobStore) {}

  @Get()
  async jobs() {
    const overviews = await this.store.readOverviews()

    return { workerSeenAt: latestWorkerSeenAt(overviews), jobs: overviews.map(jobResponse) }
  }

  @Get(':name/runs')
  async runs(@Param('name') name: string, @Query() query: unknown) {
    const page = runPageQuery.safeParse(query)
    if (!page.success) {
      throw new OpsFailure('request')
    }
    const { before, limit } = page.data
    // 다음 쪽이 있는지 알려고 한 행을 더 읽는다.
    const runs = await this.store.readRuns(name, { before, limit: limit + 1 })
    if (runs === undefined) {
      throw new OpsFailure('jobNotFound')
    }
    const pageRuns = runs.slice(0, limit)
    const nextBefore = runs.length > limit ? (pageRuns.at(-1)?.id ?? null) : null

    return { runs: pageRuns.map(runResponse), nextBefore }
  }

  @Post(':name/runs')
  @HttpCode(202)
  async requestRun(@Param('name') name: string, @Body() body: unknown) {
    const request = runRequestBody.safeParse(body)
    if (!request.success) {
      throw new OpsFailure('request')
    }
    const result = await this.store.requestRun(name, request.data.args ?? {})
    if (result.status === 'not-found') {
      throw new OpsFailure('jobNotFound')
    }

    if (result.status === 'active') {
      throw new OpsFailure('jobAlreadyRunning')
    }

    return { id: result.id }
  }

  @Post(':name/pause')
  @HttpCode(204)
  async pause(@Param('name') name: string): Promise<void> {
    throwPauseFailure(await this.store.setPaused(name, true))
  }

  @Post(':name/resume')
  @HttpCode(204)
  async resume(@Param('name') name: string): Promise<void> {
    throwPauseFailure(await this.store.setPaused(name, false))
  }
}
