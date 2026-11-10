import { Cron } from 'croner'
import { z } from 'zod'
import type { JobDefinition } from './definition.js'
import { type JobRunDependencies, executeJobRun, readErrorChain, sendJobAlert } from './run.js'

const TIMEZONE = 'Asia/Seoul'
const REQUEST_POLL_INTERVAL_MS = 1_000
const WORKER_SEEN_INTERVAL_MS = 60_000

export type JobSchedulerDependencies = JobRunDependencies & {
  jobs: readonly JobDefinition[]
}

type ScheduledJob = {
  definition: JobDefinition
  schedule: string
  /** 다음 실행 시각 계산에만 쓰고 발화하지 않는다. */
  cron: Cron
}

function scheduledJobs(jobs: readonly JobDefinition[]): ScheduledJob[] {
  return jobs.flatMap((definition) => {
    const { schedule } = definition
    if (schedule === undefined) {
      return []
    }

    return [
      { definition, schedule, cron: new Cron(schedule, { timezone: TIMEZONE, paused: true }) }
    ]
  })
}

export async function registerWorkerJobs(
  dependencies: JobSchedulerDependencies,
  now: Date
): Promise<void> {
  const { jobs, store, report } = dependencies
  const nextRuns = new Map(
    scheduledJobs(jobs).map(({ definition, cron }) => [definition.name, cron.nextRun(now)])
  )
  await store.registerJobs(
    jobs.map((definition) => ({
      name: definition.name,
      displayName: definition.displayName,
      description: definition.description,
      schedule: definition.schedule ?? null,
      argsSchema: z.toJSONSchema(definition.argsSchema),
      delayMinutes: definition.delayMinutes,
      nextRunAt: nextRuns.get(definition.name) ?? null
    }))
  )
  for (const { id, jobName, trigger, startedAt } of await store.interruptRunningRuns()) {
    report('JOB_RUN_INTERRUPTED', { job: jobName, runId: id })
    // worker 시작이 Discord 응답을 기다리지 않게 한다.
    sendJobAlert(dependencies, id, {
      kind: 'interrupted',
      job: jobName,
      trigger,
      elapsedMs: now.getTime() - startedAt.getTime()
    })
  }
}

/**
 * 수동이 아닌 마지막 성공 실행 뒤의 다음 예정 시각이 지난 정기 job이다. 성공 이력이 없어도 들고,
 * 여러 번 놓쳤어도 한 번만 든다.
 */
export async function findCatchupJobs(
  { jobs, store }: JobSchedulerDependencies,
  now: Date
): Promise<JobDefinition[]> {
  const due: JobDefinition[] = []
  for (const { definition, cron } of scheduledJobs(jobs)) {
    if (await store.isPaused(definition.name)) {
      continue
    }
    const lastSuccess = await store.readLastScheduledSuccess(definition.name)
    const nextRun = lastSuccess !== undefined ? cron.nextRun(lastSuccess) : now
    if (nextRun !== null && nextRun <= now) {
      due.push(definition)
    }
  }

  return due
}

export async function runScheduledJob(
  definition: JobDefinition,
  trigger: 'schedule' | 'catchup',
  dependencies: JobRunDependencies
): Promise<void> {
  const { store, report } = dependencies
  if (trigger === 'schedule' && (await store.isPaused(definition.name))) {
    report('JOB_RUN_SKIPPED', { job: definition.name, trigger, reason: 'paused' })

    return
  }

  const id = await store.startRun(definition.name, trigger)
  if (id === undefined) {
    report('JOB_RUN_SKIPPED', { job: definition.name, trigger, reason: 'active' })

    return
  }

  await executeJobRun(definition, { id, trigger, args: {} }, dependencies)
}

/** 요청 행을 모두 집어 실행하고, 집은 실행이 끝날 때까지 기다린다. 정지 중인 job도 실행한다. */
export async function runRequestedJobs({
  jobs,
  ...dependencies
}: JobSchedulerDependencies): Promise<void> {
  const definitions = new Map(jobs.map((definition) => [definition.name, definition]))
  const names = [...definitions.keys()]
  const runs: Promise<void>[] = []
  for (;;) {
    const claimed = await dependencies.store.claimRequestedRun(names)
    if (claimed === undefined) {
      break
    }
    const definition = definitions.get(claimed.jobName)
    if (definition !== undefined) {
      runs.push(
        executeJobRun(
          definition,
          { id: claimed.id, trigger: 'manual', args: claimed.args },
          dependencies
        )
      )
    }
  }

  await Promise.all(runs)
}

/**
 * job 실행은 기다리지 않고 바로 돌아온다. 실행 중 취소와 종료 처리는 두지 않으며, 끝난 job이 남긴
 * running 행은 다음 시작 때 interrupted가 된다. worker 인스턴스가 하나라는 전제다.
 */
export async function startJobScheduler(dependencies: JobSchedulerDependencies): Promise<void> {
  const { store, report } = dependencies
  const guard = (task: () => Promise<void>, job?: string) => {
    task().catch((error: unknown) => {
      report('JOB_SCHEDULER_FAILED', { job, errorChain: readErrorChain(error) })
    })
  }
  const now = new Date()
  await registerWorkerJobs(dependencies, now)
  for (const definition of await findCatchupJobs(dependencies, now)) {
    guard(() => runScheduledJob(definition, 'catchup', dependencies), definition.name)
  }

  for (const { definition, schedule } of scheduledJobs(dependencies.jobs)) {
    const cron: Cron = new Cron(schedule, { timezone: TIMEZONE }, () => {
      guard(async () => {
        await store.recordNextRun(definition.name, cron.nextRun())
        await runScheduledJob(definition, 'schedule', dependencies)
      }, definition.name)
    })
  }
  setInterval(() => guard(() => runRequestedJobs(dependencies)), REQUEST_POLL_INTERVAL_MS)
  setInterval(() => guard(() => store.recordWorkerSeen()), WORKER_SEEN_INTERVAL_MS)
}
