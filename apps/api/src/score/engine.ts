import { Worker } from 'node:worker_threads'
import { z } from 'zod'
import type { ScoreCalculator, ScoreEngineInput } from './input.js'
import type { ScoreWorkerData, ScoreWorkerMessage, ScoreWorkerRequest } from './worker-protocol.js'

export const SCORE_ENGINE = Symbol('SCORE_ENGINE')

export type ScoreEngineDiagnostic = 'SCORE_ENGINE_UNAVAILABLE' | 'SCORE_ENGINE_FAILED'

const nonblank = z.string().refine((value) => value.trim().length > 0)
const nullableNumber = z.number().nullable()
const resultSchema = z
  .object({
    calculator: z.enum(['equipment', 'buff']),
    score: z.int().nullable(),
    skipped: z.object({ kind: nonblank, message: nonblank }).nullable(),
    // rev14 이전 엔진은 근사값 칸을 보내지 않으므로 빠진 칸은 null로 받는다.
    approximate_score: z.int().nullable().default(null),
    approximate_source: nonblank.nullable().default(null),
    warning: nonblank.nullable().default(null),
    versions: z.object({ package: nonblank, rules_rev: nonblank, bundle_id: nonblank }),
    display: z.object({
      role: z.enum(['dealer', 'buffer']),
      switchingLevel: nullableNumber,
      buff30: nullableNumber,
      buff50: nullableNumber
    })
  })
  .refine((result) => (result.score === null) !== (result.skipped === null))
  .refine((result) => {
    if (result.approximate_score === null && result.approximate_source === null) {
      return result.warning === null || result.score !== null
    }

    return (
      result.approximate_score !== null &&
      result.approximate_source !== null &&
      result.warning !== null &&
      result.score === null
    )
  })

export type ScoreEngineResult = z.infer<typeof resultSchema>

export type ScoreWorker = {
  postMessage: (request: ScoreWorkerRequest) => void
  on(event: 'message', listener: (message: ScoreWorkerMessage) => void): unknown
  on(event: 'error', listener: (error: Error) => void): unknown
  on(event: 'exit', listener: (exitCode: number) => void): unknown
  terminate: () => Promise<unknown>
}

export type ScoreEngineOptions = Readonly<{
  /** null이면 worker를 띄우지 않고 모든 점수를 null로 둔다. */
  path: string | null
  report: (code: ScoreEngineDiagnostic) => void
  spawn?: (data: ScoreWorkerData) => ScoreWorker
}>

type ScoreReply = Extract<ScoreWorkerMessage, { kind: 'result' }>
type RunningWorker = Readonly<{
  worker: ScoreWorker
  pending: Map<number, (reply: ScoreReply | null) => void>
}>

function spawnScoreWorker(data: ScoreWorkerData): ScoreWorker {
  return new Worker(new URL('./worker.js', import.meta.url), { workerData: data })
}

function parseResult(text: string, calculator: ScoreCalculator): ScoreEngineResult | null {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return null
  }
  const parsed = resultSchema.safeParse(value)
  if (!parsed.success || parsed.data.calculator !== calculator) {
    return null
  }

  return parsed.data
}

/**
 * 네이티브 엔진은 첫 계산 초기화를 OS thread마다 따로 하므로, 만들 때 worker 하나를 띄워 준비와 모든 계산을 그
 * worker에서 한다. worker가 끝나면 다시 띄우지 않고 이후 점수를 null로 둔다.
 */
export function createScoreEngine(options: ScoreEngineOptions) {
  const { path, report, spawn = spawnScoreWorker } = options
  let running: RunningWorker | null = null
  let nextRequestId = 0

  function stop(worker: ScoreWorker, code: ScoreEngineDiagnostic | null): Promise<unknown> {
    if (running?.worker !== worker) {
      return Promise.resolve()
    }
    const { pending } = running
    running = null
    if (code !== null) {
      report(code)
    }
    for (const settle of pending.values()) {
      settle(null)
    }
    pending.clear()

    return worker.terminate()
  }

  function start(libraryPath: string): void {
    let worker: ScoreWorker
    try {
      worker = spawn({ path: libraryPath })
    } catch {
      report('SCORE_ENGINE_FAILED')

      return
    }
    running = { worker, pending: new Map() }
    const fail = (): void => {
      stop(worker, 'SCORE_ENGINE_FAILED').catch(() => undefined)
    }
    worker.on('message', (message) => {
      if (message.kind === 'unavailable') {
        stop(worker, 'SCORE_ENGINE_UNAVAILABLE').catch(() => undefined)

        return
      }

      if (running?.worker === worker) {
        running.pending.get(message.id)?.(message)
      }
    })
    worker.on('error', fail)
    worker.on('exit', fail)
  }

  function request(
    current: RunningWorker,
    input: ScoreEngineInput,
    calculator: ScoreCalculator,
    signal: AbortSignal
  ): Promise<ScoreReply | null> {
    const id = nextRequestId
    nextRequestId += 1

    return new Promise((resolve, reject) => {
      const cleanup = (): void => {
        signal.removeEventListener('abort', abort)
        current.pending.delete(id)
      }
      // 계산 중인 네이티브 호출은 멈출 수 없으므로, 취소된 요청은 응답을 기다리지 않고 늦은 응답은 버린다.
      const abort = (): void => {
        cleanup()
        reject(signal.reason)
      }
      current.pending.set(id, (reply) => {
        cleanup()
        resolve(reply)
      })
      signal.addEventListener('abort', abort, { once: true })
      current.worker.postMessage({ id, input, calculator })
    })
  }

  if (path !== null) {
    start(path)
  }

  return {
    /** 엔진이 없거나 계산하지 못하면 null이다. 신호가 취소되면 그 이유로 거절한다. */
    async calculate(
      input: ScoreEngineInput,
      calculator: ScoreCalculator,
      signal: AbortSignal
    ): Promise<ScoreEngineResult | null> {
      signal.throwIfAborted()
      if (running === null) {
        return null
      }
      const reply = await request(running, input, calculator, signal)
      if (reply === null) {
        return null
      }
      const result = reply.text !== null ? parseResult(reply.text, calculator) : null
      if (result === null) {
        report('SCORE_ENGINE_FAILED')
      }

      return result
    },
    async onModuleDestroy() {
      if (running !== null) {
        await stop(running.worker, null)
      }
    }
  }
}

export type ScoreEngine = ReturnType<typeof createScoreEngine>
