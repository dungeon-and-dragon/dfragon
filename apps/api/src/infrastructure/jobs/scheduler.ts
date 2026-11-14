import { Cron } from 'croner'
import type { JobSchedule, ReportJobEvent } from '../../application/jobs/ports.js'
import { readErrorChain } from '../../application/jobs/run.js'
import type { JobSchedulerService } from '../../application/jobs/scheduler.js'

const TIMEZONE = 'Asia/Seoul'
const REQUEST_POLL_INTERVAL_MS = 1_000
const WORKER_SEEN_INTERVAL_MS = 60_000

export function createJobSchedule(schedule: string): JobSchedule {
  return new Cron(schedule, { timezone: TIMEZONE, paused: true })
}

export function isJobSchedule(schedule: string): boolean {
  try {
    createJobSchedule(schedule)

    return true
  } catch {
    return false
  }
}

/**
 * job 실행은 기다리지 않고 바로 돌아온다. 실행 중 취소와 종료 처리는 두지 않으며, 끝난 job이 남긴
 * running 행은 다음 시작 때 interrupted가 된다. worker 인스턴스가 하나라는 전제다.
 */
export async function startJobScheduler(
  scheduler: JobSchedulerService,
  report: ReportJobEvent
): Promise<void> {
  const guard = (task: () => Promise<void>, job?: string) => {
    task().catch((error: unknown) => {
      report('JOB_SCHEDULER_FAILED', { job, errorChain: readErrorChain(error) })
    })
  }
  const now = new Date()
  await scheduler.register(now, createJobSchedule)
  for (const definition of await scheduler.findCatchupJobs(now, createJobSchedule)) {
    guard(() => scheduler.runScheduled(definition, 'catchup'), definition.name)
  }

  for (const { definition, schedule } of scheduler.scheduledJobs(createJobSchedule)) {
    const cron: Cron = new Cron(schedule, { timezone: TIMEZONE }, () => {
      guard(async () => {
        await scheduler.recordNextRun(definition.name, cron.nextRun())
        await scheduler.runScheduled(definition, 'schedule')
      }, definition.name)
    })
  }
  setInterval(() => guard(() => scheduler.runRequested()), REQUEST_POLL_INTERVAL_MS)
  setInterval(() => guard(() => scheduler.recordWorkerSeen()), WORKER_SEEN_INTERVAL_MS)
}
