import type { WorkerEventInput } from '@dfragon/database'

const FLUSH_INTERVAL_MS = 1_000

export type WorkerEventRecorderDependencies = {
  recordEvents: (events: readonly WorkerEventInput[]) => Promise<void>
  onFailure: () => void
}

export type WorkerEventRecorder = {
  record(code: string, details?: Readonly<Record<string, unknown>>): void
}

// 실패한 묶음은 다시 넣지 않는다. 로그 저장이 막혀도 stdout 로그는 남고, 쌓아 두면 DB 장애 동안 메모리만 늘어난다.
export function startWorkerEventRecorder({
  recordEvents,
  onFailure
}: WorkerEventRecorderDependencies): WorkerEventRecorder {
  let pending: WorkerEventInput[] = []

  setInterval(() => {
    if (pending.length === 0) {
      return
    }

    const events = pending
    pending = []
    recordEvents(events).catch(onFailure)
  }, FLUSH_INTERVAL_MS)

  return {
    record(code, details = {}) {
      const occurredAt = new Date()
      pending.push({ occurredAt, code, details })
    }
  }
}
