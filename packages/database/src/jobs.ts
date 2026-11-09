import type { DatabaseClient } from './client.js'

export type JobTrigger = 'schedule' | 'catchup' | 'manual'

export type JobRegistration = {
  name: string
  displayName: string
  schedule: string | null
  argsSchema: object
  delayMinutes: number
  nextRunAt: Date | null
}

export type JobRunReference = {
  id: number
  jobName: string
}

export type ClaimedJobRun = JobRunReference & {
  args: unknown
}

export type JobRunProgress = {
  done: number
  total: number | null
}

export type JobRunSummary = Readonly<Record<string, string | number | boolean | null>>

export type JobRunErrorEntry = {
  name: string
  code?: string
  frames?: readonly string[]
}

export type JobRunOutcome =
  | { status: 'succeeded'; progress: JobRunProgress | null; summary: JobRunSummary | null }
  | { status: 'failed'; progress: JobRunProgress | null; error: readonly JobRunErrorEntry[] }

// 일시 정지는 운영 화면이 정하므로 다시 등록해도 그대로 둔다.
export async function registerJobs(
  client: DatabaseClient,
  jobs: readonly JobRegistration[]
): Promise<void> {
  await client.$transaction(async (transaction) => {
    await transaction.job.deleteMany({ where: { name: { notIn: jobs.map(({ name }) => name) } } })
    for (const { name, displayName, schedule, argsSchema, delayMinutes, nextRunAt } of jobs) {
      await transaction.$executeRaw`
        INSERT INTO "jobs"
          ("name", "display_name", "schedule", "args_schema", "delay_minutes", "next_run_at", "worker_seen_at")
        VALUES (
          ${name}, ${displayName}, ${schedule}, ${JSON.stringify(argsSchema)}::jsonb, ${delayMinutes},
          ${nextRunAt}, now()
        )
        ON CONFLICT ("name") DO UPDATE SET
          "display_name" = EXCLUDED."display_name",
          "schedule" = EXCLUDED."schedule",
          "args_schema" = EXCLUDED."args_schema",
          "delay_minutes" = EXCLUDED."delay_minutes",
          "next_run_at" = EXCLUDED."next_run_at",
          "worker_seen_at" = EXCLUDED."worker_seen_at"`
    }
  })
}

export async function recordJobWorkerSeen(client: DatabaseClient): Promise<void> {
  await client.job.updateMany({ data: { workerSeenAt: new Date() } })
}

export async function recordJobNextRun(
  client: DatabaseClient,
  name: string,
  nextRunAt: Date | null
): Promise<void> {
  await client.job.updateMany({ where: { name }, data: { nextRunAt } })
}

export async function isJobPaused(client: DatabaseClient, name: string): Promise<boolean> {
  const job = await client.job.findUnique({ where: { name }, select: { pausedAt: true } })

  return job?.pausedAt != null
}

export async function readLastScheduledJobSuccess(
  client: DatabaseClient,
  jobName: string
): Promise<Date | undefined> {
  const run = await client.jobRun.findFirst({
    where: { jobName, status: 'succeeded', trigger: { not: 'manual' } },
    orderBy: { requestedAt: 'desc' },
    select: { startedAt: true }
  })

  if (run?.startedAt == null) {
    return undefined
  }

  return run.startedAt
}

export async function interruptRunningJobRuns(client: DatabaseClient): Promise<JobRunReference[]> {
  return client.$queryRaw<JobRunReference[]>`
    UPDATE "job_runs" SET "status" = 'interrupted', "finished_at" = now()
    WHERE "status" = 'running'
    RETURNING "id", "job_name" AS "jobName"`
}

// 같은 job의 요청이나 실행 중인 행이 있으면 partial unique index 때문에 행을 만들지 않고 undefined를 돌려준다.
export async function startJobRun(
  client: DatabaseClient,
  jobName: string,
  trigger: Exclude<JobTrigger, 'manual'>
): Promise<number | undefined> {
  const [run] = await client.$queryRaw<Array<{ id: number }>>`
    INSERT INTO "job_runs" ("job_name", "trigger", "status", "args", "started_at")
    VALUES (${jobName}, ${trigger}, 'running', '{}'::jsonb, now())
    ON CONFLICT DO NOTHING
    RETURNING "id"`

  return run?.id
}

export async function claimRequestedJobRun(
  client: DatabaseClient,
  jobNames: readonly string[]
): Promise<ClaimedJobRun | undefined> {
  // 겹친 두 claim이 같은 행을 고르면 뒤의 UPDATE는 앞의 commit을 기다린 뒤 status를 다시 보고 행을 집지 않는다.
  const [run] = await client.$queryRaw<ClaimedJobRun[]>`
    UPDATE "job_runs" SET "status" = 'running', "started_at" = now()
    WHERE "status" = 'requested' AND "id" = (
      SELECT "id" FROM "job_runs"
      WHERE "status" = 'requested' AND "job_name" = ANY(${jobNames}::text[])
      ORDER BY "requested_at", "id"
      LIMIT 1
    )
    RETURNING "id", "job_name" AS "jobName", "args"`

  return run
}

export async function recordJobRunProgress(
  client: DatabaseClient,
  id: number,
  progress: JobRunProgress
): Promise<void> {
  await client.jobRun.updateMany({
    where: { id, status: 'running' },
    data: { progressDone: progress.done, progressTotal: progress.total }
  })
}

export async function finishJobRun(
  client: DatabaseClient,
  id: number,
  outcome: JobRunOutcome
): Promise<void> {
  const { status, progress } = outcome
  const summary = outcome.status === 'succeeded' ? outcome.summary : null
  const error = outcome.status === 'failed' ? outcome.error : null

  await client.$executeRaw`
    UPDATE "job_runs" SET
      "status" = ${status},
      "finished_at" = now(),
      "progress_done" = ${progress?.done ?? null}::int,
      "progress_total" = ${progress?.total ?? null}::int,
      "summary" = ${summary !== null ? JSON.stringify(summary) : null}::jsonb,
      "error" = ${error !== null ? JSON.stringify(error) : null}::jsonb
    WHERE "id" = ${id} AND "status" = 'running'`
}

export async function deleteJobRunsFinishedBefore(
  client: DatabaseClient,
  cutoff: Date
): Promise<number> {
  const { count } = await client.jobRun.deleteMany({ where: { finishedAt: { lt: cutoff } } })

  return count
}
