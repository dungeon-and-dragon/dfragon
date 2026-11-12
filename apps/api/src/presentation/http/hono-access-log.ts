import { randomUUID } from 'node:crypto'
import type { HttpBindings } from '@hono/node-server'
import type { Context, MiddlewareHandler } from 'hono'
import { matchedRoutes } from 'hono/route'
import { METHOD_NAME_ALL } from 'hono/router'
import {
  type AccessLogRecord,
  type AccessLogSink,
  CORRELATION_ID_HEADER,
  UNMATCHED_ROUTE,
  describeAccessLogErrorChain,
  writeAccessLogLine
} from './access-log-entry.js'

export type AccessLogEnv = {
  Bindings: HttpBindings
  Variables: { accessLog: AccessLogRecord }
}

export function recordAccessLogErrorCode(c: Context<AccessLogEnv>, code: string): void {
  c.get('accessLog').code = code
}

export function recordAccessLogErrorChain(c: Context<AccessLogEnv>, error: unknown): void {
  const chain = describeAccessLogErrorChain(error)
  if (chain !== undefined) {
    c.get('accessLog').errorChain = chain
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
