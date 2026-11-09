import type { JobRunOutcome, JobRunProgress, JobTrigger } from '@dfragon/database'
import { type ErrorChainEntry, describeErrorChain } from '../error-chain.js'
import type { JobDefinition, JobStore, ReportJobEvent } from './definition.js'

const PROGRESS_WRITE_INTERVAL_MS = 10_000

export type JobRunTarget = {
  id: number
  trigger: JobTrigger
  args: unknown
}

export type JobRunDependencies = {
  store: JobStore
  report: ReportJobEvent
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

/** 실패도 이력과 로그로 남기고 던지지 않아, job 하나가 worker의 다른 일을 멈추지 않는다. */
export async function executeJobRun(
  definition: JobDefinition,
  target: JobRunTarget,
  { store, report }: JobRunDependencies
): Promise<void> {
  const event = { job: definition.name, runId: target.id, trigger: target.trigger }
  const startedAt = performance.now()
  let progress: JobRunProgress | null = null
  let writtenProgress: JobRunProgress | null = null
  const progressWriter = setInterval(() => {
    if (progress === null || progress === writtenProgress) {
      return
    }
    writtenProgress = progress
    store.recordProgress(target.id, progress).catch((error: unknown) => {
      report('JOB_PROGRESS_RECORD_FAILED', { ...event, errorChain: readErrorChain(error) })
    })
  }, PROGRESS_WRITE_INTERVAL_MS)
  report('JOB_RUN_STARTED', event)

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
    report('JOB_RUN_SUCCEEDED', { ...event, durationMs })
  } else {
    report('JOB_RUN_FAILED', { ...event, durationMs, errorChain: outcome.error })
  }

  try {
    await store.finishRun(target.id, outcome)
  } catch (error) {
    report('JOB_RUN_RECORD_FAILED', { ...event, errorChain: readErrorChain(error) })
  }
}
