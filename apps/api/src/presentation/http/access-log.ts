import { randomUUID } from 'node:crypto'
import type { Writable } from 'node:stream'
import type { NextFunction, Request, Response } from 'express'
import type { ErrorChainEntry } from '../../domain/error-chain.js'
import {
  type AccessLogSink,
  CORRELATION_ID_HEADER,
  UNMATCHED_ROUTE,
  describeAccessLogErrorChain,
  writeAccessLogLine
} from './access-log-entry.js'

export type { AccessLogSink }

const errorCodes = new WeakMap<Response, string>()
const errorChains = new WeakMap<Response, ErrorChainEntry[]>()
const neopleStages = new WeakMap<Response, Record<string, number>>()
const sharedNeopleFetches = new WeakSet<Response>()
const cachedResponses = new WeakSet<Response>()

function dropStreamError(): void {
  // 닫힌 log pipe의 EPIPE 같은 쓰기 오류는 접근 로그 한 줄을 잃는 것으로 끝낸다.
}

/**
 * 첫 쓰기 때 오류 listener를 두어, stdout pipe가 닫혀도 처리되지 않은 `error` event로 서버 process가 끝나지 않게 한다.
 */
export function createStreamAccessLogSink(stream: Writable): AccessLogSink {
  let isWatchingErrors = false

  return (line) => {
    if (!isWatchingErrors) {
      stream.on('error', dropStreamError)
      isWatchingErrors = true
    }
    stream.write(`${line}\n`)
  }
}

export const writeAccessLogToStdout = createStreamAccessLogSink(process.stdout)

export type ReportCode = (code: string) => void

export function createCodeReport(sink: AccessLogSink, service: string): ReportCode {
  return (code) => sink(JSON.stringify({ time: new Date().toISOString(), service, code }))
}

export function recordAccessLogErrorCode(response: Response, code: string): void {
  errorCodes.set(response, code)
}

export function recordAccessLogNeopleStage(
  response: Response,
  stage: string,
  durationMs: number
): void {
  neopleStages.set(response, { ...neopleStages.get(response), [stage]: durationMs })
}

export function recordAccessLogSharedNeopleFetch(response: Response): void {
  sharedNeopleFetches.add(response)
}

export function recordAccessLogCachedResponse(response: Response): void {
  cachedResponses.add(response)
}

export function recordAccessLogErrorChain(response: Response, error: unknown): void {
  const chain = describeAccessLogErrorChain(error)
  if (chain !== undefined) {
    errorChains.set(response, chain)
  }
}

function readRouteTemplate(request: Request): string {
  const route: unknown = request.route
  if (
    typeof route !== 'object' ||
    route === null ||
    !('path' in route) ||
    typeof route.path !== 'string'
  ) {
    return UNMATCHED_ROUTE
  }

  return route.path
}

/**
 * Correlation ID는 클라이언트 값 대신 서버가 만들어 `X-Correlation-Id` 응답 header로도 돌려준다.
 */
export function createAccessLog(sink: AccessLogSink, service: string) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const startedAt = performance.now()
    const correlationId = randomUUID()
    response.setHeader(CORRELATION_ID_HEADER, correlationId)
    response.once('close', () => {
      const neopleShared = sharedNeopleFetches.has(response) ? true : undefined
      const responseCached = cachedResponses.has(response) ? true : undefined
      writeAccessLogLine(
        sink,
        {
          service,
          method: request.method,
          route: readRouteTemplate(request),
          startedAt,
          correlationId
        },
        response,
        {
          code: errorCodes.get(response),
          errorChain: errorChains.get(response),
          neopleMs: neopleStages.get(response),
          neopleShared,
          responseCached
        }
      )
    })
    next()
  }
}
