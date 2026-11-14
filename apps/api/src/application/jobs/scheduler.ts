import { z } from 'zod'
import type { JobDefinition } from './definition.js'
import type { CreateJobSchedule, JobSchedule, JobSchedulerPorts } from './ports.js'
import type { JobRepository } from './repository.js'
import { JobRunService } from './run.js'

type ScheduledJob = {
  definition: JobDefinition
  schedule: string
  /** 다음 실행 시각 계산에만 쓰고 발화하지 않는다. */
  cron: JobSchedule
}

export class JobSchedulerService {
  private readonly runs: JobRunService

  constructor(
    private readonly repository: JobRepository,
    private readonly ports: JobSchedulerPorts
  ) {
    this.runs = new JobRunService(repository, ports.report, ports.alert)
  }

  scheduledJobs(createSchedule: CreateJobSchedule): ScheduledJob[] {
    return this.ports.jobs.flatMap((definition) => {
      const { schedule } = definition
      if (schedule === undefined) {
        return []
      }

      const cron = createSchedule(schedule)

      return [{ definition, schedule, cron }]
    })
  }

  async register(now: Date, createSchedule: CreateJobSchedule): Promise<void> {
    const { jobs, report } = this.ports
    const nextRuns = new Map(
      this.scheduledJobs(createSchedule).map(({ definition, cron }) => [
        definition.name,
        cron.nextRun(now)
      ])
    )
    await this.repository.registerJobs(
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
    for (const {
      id,
      jobName,
      trigger,
      startedAt
    } of await this.repository.interruptRunningRuns()) {
      report('JOB_RUN_INTERRUPTED', { job: jobName, runId: id })
      // worker 시작이 Discord 응답을 기다리지 않게 한다.
      this.runs.sendAlert(id, {
        kind: 'interrupted',
        job: jobName,
        trigger,
        elapsedMs: now.getTime() - startedAt.getTime()
      })
    }
  }

  /**
   * 수동이 아닌 마지막 성공 실행 뒤의 다음 예정 시각이 지난 정기 job이다. 성공 이력이 없어도 들고,
   * 여러 번 놓쳤어도 한 번만 든다. 보충을 끈 job은 들지 않는다.
   */
  async findCatchupJobs(now: Date, createSchedule: CreateJobSchedule): Promise<JobDefinition[]> {
    const due: JobDefinition[] = []
    for (const { definition, cron } of this.scheduledJobs(createSchedule)) {
      if (definition.catchup === false || (await this.repository.isPaused(definition.name))) {
        continue
      }
      const lastSuccess = await this.repository.readLastScheduledSuccess(definition.name)
      const nextRun = lastSuccess !== undefined ? cron.nextRun(lastSuccess) : now
      if (nextRun !== null && nextRun <= now) {
        due.push(definition)
      }
    }

    return due
  }

  runScheduled(definition: JobDefinition, trigger: 'schedule' | 'catchup'): Promise<void> {
    return this.runs.runScheduled(definition, trigger)
  }

  /** 요청 행을 모두 집어 실행하고, 집은 실행이 끝날 때까지 기다린다. 정지 중인 job도 실행한다. */
  async runRequested(): Promise<void> {
    const definitions = new Map(this.ports.jobs.map((definition) => [definition.name, definition]))
    const names = [...definitions.keys()]
    const runs: Promise<void>[] = []
    for (;;) {
      const claimed = await this.repository.claimRequestedRun(names)
      if (claimed === undefined) {
        break
      }
      const definition = definitions.get(claimed.jobName)
      if (definition !== undefined) {
        runs.push(
          this.runs.execute(definition, { id: claimed.id, trigger: 'manual', args: claimed.args })
        )
      }
    }

    await Promise.all(runs)
  }

  recordNextRun(name: string, nextRunAt: Date | null): Promise<void> {
    return this.repository.recordNextRun(name, nextRunAt)
  }

  recordWorkerSeen(): Promise<void> {
    return this.repository.recordWorkerSeen()
  }
}
