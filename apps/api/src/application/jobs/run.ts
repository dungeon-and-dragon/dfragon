import type { JobRunOutcome, JobRunProgress, JobTrigger } from '@dfragon/database'
import { type ErrorChainEntry, describeErrorChain } from '@dfragon/lib/error-chain'
import type { JobDefinition } from './definition.js'
import type { ReportJobEvent } from './ports.js'
import type { JobRepository } from './repository.js'

const PROGRESS_WRITE_INTERVAL_MS = 1_000

export type JobRunTarget = {
  id: number
  trigger: JobTrigger
  args: unknown
}

class InvalidJobArguments extends Error {
  readonly code = 'INVALID_JOB_ARGS'

  constructor() {
    super('Invalid job arguments')
    this.name = 'InvalidJobArguments'
  }
}

export function readErrorChain(error: unknown): ErrorChainEntry[] {
  try {
    return describeErrorChain(error)
  } catch {
    // getter가 던지는 오류처럼 정제 결과를 믿을 수 없으면 원인 없이 실패만 남긴다.
    return []
  }
}

async function runDefinition(
  definition: JobDefinition,
  args: unknown,
  onProgress: (progress: JobRunProgress) => void
) {
  const parsed = definition.argsSchema.safeParse(args)
  if (!parsed.success) {
    // zod issue는 입력값을 담을 수 있어 오류 code만 남긴다.
    throw new InvalidJobArguments()
  }

  return definition.run(parsed.data, {
    reportProgress: (done, total) => onProgress({ done, total: total ?? null })
  })
}

export class JobRunService {
  constructor(
    private readonly repository: JobRepository,
    private readonly report: ReportJobEvent
  ) {}

  /** 실패도 이력과 로그로 남기고 던지지 않아, job 하나가 worker의 다른 일을 멈추지 않는다. */
  async execute(definition: JobDefinition, target: JobRunTarget): Promise<void> {
    const event = { job: definition.name, runId: target.id, trigger: target.trigger }
    const startedAt = performance.now()
    let progress: JobRunProgress | null = null
    let writtenProgress: JobRunProgress | null = null
    const progressWriter = setInterval(() => {
      if (progress === null) {
        return
      }

      const progressUnchanged =
        progress.done === writtenProgress?.done && progress.total === writtenProgress.total
      if (progressUnchanged) {
        return
      }
      writtenProgress = progress
      this.repository.recordProgress(target.id, progress).catch((error: unknown) => {
        this.report('JOB_PROGRESS_RECORD_FAILED', { ...event, errorChain: readErrorChain(error) })
      })
    }, PROGRESS_WRITE_INTERVAL_MS)
    this.report('JOB_RUN_STARTED', event)

    let outcome: JobRunOutcome
    try {
      const summary = await runDefinition(definition, target.args, (next) => {
        progress = next
      })
      outcome = { status: 'succeeded', progress, summary: summary ?? null }
    } catch (error) {
      outcome = { status: 'failed', progress, error: readErrorChain(error) }
    } finally {
      clearInterval(progressWriter)
    }

    const durationMs = Math.round(performance.now() - startedAt)
    if (outcome.status === 'succeeded') {
      this.report('JOB_RUN_SUCCEEDED', { ...event, durationMs })
    } else {
      this.report('JOB_RUN_FAILED', { ...event, durationMs, errorChain: outcome.error })
    }

    try {
      await this.repository.finishRun(target.id, outcome)
    } catch (error) {
      this.report('JOB_RUN_RECORD_FAILED', { ...event, errorChain: readErrorChain(error) })
    }
  }

  async runScheduled(definition: JobDefinition, trigger: 'schedule' | 'catchup'): Promise<void> {
    if (trigger === 'schedule' && (await this.repository.isPaused(definition.name))) {
      this.report('JOB_RUN_SKIPPED', { job: definition.name, trigger, reason: 'paused' })

      return
    }

    const id = await this.repository.startRun(definition.name, trigger)
    if (id === undefined) {
      this.report('JOB_RUN_SKIPPED', { job: definition.name, trigger, reason: 'active' })

      return
    }

    await this.execute(definition, { id, trigger, args: {} })
  }
}
