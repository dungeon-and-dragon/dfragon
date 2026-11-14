import type { JobOverview, JobPauseChange, JobRunRecord } from '@dfragon/database'
import { Hono } from 'hono'
import { z } from 'zod'
import type { OpsJobStore } from '../../../application/jobs/ports.js'
import { OpsFailure } from '../../../domain/failure.js'
import { readJsonBody } from '../json-request.js'

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

export function createOpsJobRoutes(store: OpsJobStore): Hono {
  const routes = new Hono()

  routes.get('/', async (c) => {
    const overviews = await store.readOverviews()

    return c.json({ workerSeenAt: latestWorkerSeenAt(overviews), jobs: overviews.map(jobResponse) })
  })

  routes.get('/:name/runs', async (c) => {
    const page = runPageQuery.safeParse(c.req.query())
    if (!page.success) {
      throw new OpsFailure('request')
    }
    const { before, limit } = page.data
    // 다음 쪽이 있는지 알려고 한 행을 더 읽는다.
    const runs = await store.readRuns(c.req.param('name'), { before, limit: limit + 1 })
    if (runs === undefined) {
      throw new OpsFailure('jobNotFound')
    }
    const pageRuns = runs.slice(0, limit)
    const nextBefore = runs.length > limit ? (pageRuns.at(-1)?.id ?? null) : null

    return c.json({ runs: pageRuns.map(runResponse), nextBefore })
  })

  routes.post('/:name/runs', async (c) => {
    const request = runRequestBody.safeParse(await readJsonBody(c))
    if (!request.success) {
      throw new OpsFailure('request')
    }
    const result = await store.requestRun(c.req.param('name'), request.data.args ?? {})
    if (result.status === 'not-found') {
      throw new OpsFailure('jobNotFound')
    }

    if (result.status === 'active') {
      throw new OpsFailure('jobAlreadyRunning')
    }

    return c.json({ id: result.id }, 202)
  })

  routes.post('/:name/pause', async (c) => {
    throwPauseFailure(await store.setPaused(c.req.param('name'), true))

    return c.body(null, 204)
  })

  routes.post('/:name/resume', async (c) => {
    throwPauseFailure(await store.setPaused(c.req.param('name'), false))

    return c.body(null, 204)
  })

  return routes
}
