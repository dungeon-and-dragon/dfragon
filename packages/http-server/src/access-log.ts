import { randomUUID } from 'node:crypto'
import type { ServerResponse } from 'node:http'
import type { HttpBindings } from '@hono/node-server'
import type { Context, MiddlewareHandler } from 'hono'
import { matchedRoutes } from 'hono/route'
import { METHOD_NAME_ALL } from 'hono/router'
import { type ErrorChainEntry, describeErrorChain } from '@dfragon/lib/error-chain'
import type { AccessLogSink } from './access-log-sink.js'

// 매칭된 route가 없으면 credential이 담길 수 있는 원문 경로 대신 고정 값을 남긴다.
const UNMATCHED_ROUTE = '<unmatched>'
const CORRELATION_ID_HEADER = 'X-Correlation-Id'

interface AccessLogRequest {
  readonly service: string
  readonly method: string
  readonly route: string
  readonly startedAt: number
  readonly correlationId: string
}

interface AccessLogRecord {
  code?: string
  errorChain?: ErrorChainEntry[]
  neopleMs?: Record<string, number>
  neopleShared?: true
  responseCached?: true
}

export type AccessLogEnv = {
  Bindings: HttpBindings
  Variables: { accessLog: AccessLogRecord }
}

export function recordAccessLogErrorCode(c: Context<AccessLogEnv>, code: string): void {
  c.get('accessLog').code = code
}

/**
 * 오류 object는 보관하지 않는다.
 */
export function recordAccessLogErrorChain(c: Context<AccessLogEnv>, error: unknown): void {
  try {
    const chain = describeErrorChain(error)
    if (chain.length > 0) {
      c.get('accessLog').errorChain = chain
    }
  } catch {
    // getter가 예외를 던지는 등 정제 결과를 믿을 수 없는 오류는 원인을 생략하고 status, code만 남긴다.
  }
}

export function recordAccessLogNeopleStage(
  c: Context<AccessLogEnv>,
  stage: string,
  durationMs: number
): void {
  const record = c.get('accessLog')
  record.neopleMs = { ...record.neopleMs, [stage]: durationMs }
}

export function recordAccessLogSharedNeopleFetch(c: Context<AccessLogEnv>): void {
  c.get('accessLog').neopleShared = true
}

export function recordAccessLogCachedResponse(c: Context<AccessLogEnv>): void {
  c.get('accessLog').responseCached = true
}

function readRouteTemplate(c: Context): string {
  const route = matchedRoutes(c).at(c.req.routeIndex)
  // `use`로 등록한 middleware는 method가 ALL이다. 요청이 route handler에 닿지 못했으면 지금 실행 위치가 middleware다.
  if (route === undefined || route.method === METHOD_NAME_ALL) {
    return UNMATCHED_ROUTE
  }

  return route.path
}

/**
 * 요청 하나당 allowlist field만 담은 JSON 한 줄을 남긴다. URL, query, header, body와
 * 오류 message는 남기지 않고, 5xx 응답에만 정제한 오류 chain을 붙인다. 캐릭터 상세 요청에는
 * 끝난 Neople 단계별 대기 시간과 저장한 응답 본문을 다시 보냈는지만 붙이고, 후보 검색 요청에는
 * 저장한 결과를 보냈는지와 진행 중인 검색에 합류했는지만 붙인다. 응답의 `close` event에서 부른다.
 */
function writeAccessLogLine(
  sink: AccessLogSink,
  request: AccessLogRequest,
  response: ServerResponse,
  record: AccessLogRecord
): void {
  // Header 전송 전에 연결이 끊기면 기본값 200은 실제 응답이 아니므로 status를 생략한다.
  const status = response.headersSent ? response.statusCode : undefined
  const aborted = response.writableFinished ? undefined : true
  const isServerError = status !== undefined && status >= 500
  const errorChain = isServerError ? record.errorChain : undefined
  const entry = {
    time: new Date().toISOString(),
    service: request.service,
    method: request.method,
    route: request.route,
    status,
    code: record.code,
    errorChain,
    durationMs: Math.round(performance.now() - request.startedAt),
    neopleMs: record.neopleMs,
    neopleShared: record.neopleShared,
    responseCached: record.responseCached,
    correlationId: request.correlationId,
    aborted
  }
  try {
    sink(JSON.stringify(entry))
  } catch {
    // 접근 로그의 close listener가 먼저 등록되므로, 예외를 넘기면 process가 끝나고 뒤에 등록된
    // close listener(요청 signal의 abort)도 실행되지 않는다. 로그 한 줄만 버린다.
  }
}

/**
 * 다른 middleware의 거절까지 재도록 가장 먼저 등록한다. Correlation ID는 클라이언트 값 대신 서버가 만들어
 * `X-Correlation-Id` 응답 header로도 돌려준다.
 */
export function createAccessLog(
  sink: AccessLogSink,
  service: string
): MiddlewareHandler<AccessLogEnv> {
  return async (c, next) => {
    const startedAt = performance.now()
    const correlationId = randomUUID()
    const record: AccessLogRecord = {}
    c.set('accessLog', record)
    // 보낸 status와 연결 끊김은 Hono의 Response가 아니라 Node 응답이 닫힐 때의 상태로만 알 수 있다.
    c.env.outgoing.once('close', () => {
      writeAccessLogLine(
        sink,
        { service, method: c.req.method, route: readRouteTemplate(c), startedAt, correlationId },
        c.env.outgoing,
        record
      )
    })
    await next()
    c.res.headers.set(CORRELATION_ID_HEADER, correlationId)
  }
}
