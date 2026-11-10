import type { JobRunOutcome, JobRunProgress, JobTrigger } from '@dfragon/database'
import { type ErrorChainEntry, describeErrorChain } from '../../error-chain.js'
import type { JobDefinition } from './definition.js'
import type { JobAlert, JobStore, ReportJobEvent, SendJobAlert } from './ports.js'

const PROGRESS_WRITE_INTERVAL_MS = 1_000

export type JobRunTarget = {
  id: number
  trigger: JobTrigger
  args: unknown
}

export type JobRunDependencies = {
  store: JobStore
  report: ReportJobEvent
  alert?: SendJobAlert
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

/** 알림 전송이 실패해도 실행 결과와 이력은 그대로 두고 로그 한 줄만 남긴다. */
export async function sendJobAlert(
  { alert, report }: JobRunDependencies,
  runId: number,
  jobAlert: JobAlert
): Promise<void> {
  if (alert === undefined) {
    return
  }

  try {
    await alert(jobAlert)
  } catch (error) {
    // 웹훅 URL이 오류 message에 들어갈 수 있어 오류 chain만 남긴다.
    report('JOB_ALERT_FAILED', { job: jobAlert.job, runId, errorChain: readErrorChain(error) })
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
  dependencies: JobRunDependencies
): Promise<void> {
  const { store, report } = dependencies
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
    store.recordProgress(target.id, progress).catch((error: unknown) => {
      report('JOB_PROGRESS_RECORD_FAILED', { ...event, errorChain: readErrorChain(error) })
    })
  }, PROGRESS_WRITE_INTERVAL_MS)
  const delayMs = definition.delayMinutes * 60_000
  const delayAlert = setTimeout(() => {
    sendJobAlert(dependencies, target.id, {
      kind: 'delayed',
      job: definition.name,
      trigger: target.trigger,
      elapsedMs: delayMs
    })
  }, delayMs)
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
    clearTimeout(delayAlert)
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

  if (outcome.status === 'failed') {
    await sendJobAlert(dependencies, target.id, {
      kind: 'failed',
      job: definition.name,
      trigger: target.trigger,
      elapsedMs: durationMs,
      errorChain: outcome.error
    })
  }
}
