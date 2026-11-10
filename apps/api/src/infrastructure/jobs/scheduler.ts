import { Cron } from 'croner'
import type { JobSchedule } from '../../application/jobs/ports.js'
import { readErrorChain } from '../../application/jobs/run.js'
import {
  type JobSchedulerDependencies,
  findCatchupJobs,
  registerWorkerJobs,
  runRequestedJobs,
  runScheduledJob,
  scheduledJobs
} from '../../application/jobs/scheduler.js'

const TIMEZONE = 'Asia/Seoul'
const REQUEST_POLL_INTERVAL_MS = 1_000
const WORKER_SEEN_INTERVAL_MS = 60_000

export function createJobSchedule(schedule: string): JobSchedule {
  return new Cron(schedule, { timezone: TIMEZONE, paused: true })
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
  await registerWorkerJobs(dependencies, now, createJobSchedule)
  for (const definition of await findCatchupJobs(dependencies, now, createJobSchedule)) {
    guard(() => runScheduledJob(definition, 'catchup', dependencies), definition.name)
  }

  for (const { definition, schedule } of scheduledJobs(dependencies.jobs, createJobSchedule)) {
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
