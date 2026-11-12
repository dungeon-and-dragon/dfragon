import type { ServerResponse } from 'node:http'
import { type ErrorChainEntry, describeErrorChain } from '../../domain/error-chain.js'

export type AccessLogSink = (line: string) => void

// 매칭된 route가 없으면 credential이 담길 수 있는 원문 경로 대신 고정 값을 남긴다.
export const UNMATCHED_ROUTE = '<unmatched>'
export const CORRELATION_ID_HEADER = 'X-Correlation-Id'

export interface AccessLogRequest {
  readonly service: string
  readonly method: string
  readonly route: string
  readonly startedAt: number
  readonly correlationId: string
}

export interface AccessLogRecord {
  code?: string
  errorChain?: ErrorChainEntry[]
  neopleMs?: Record<string, number>
  neopleShared?: true
  responseCached?: true
}

/**
 * 오류 object는 보관하지 않는다.
 */
export function describeAccessLogErrorChain(error: unknown): ErrorChainEntry[] | undefined {
  try {
    const chain = describeErrorChain(error)
    if (chain.length > 0) {
      return chain
    }
  } catch {
    // getter가 예외를 던지는 등 정제 결과를 믿을 수 없는 오류는 원인을 생략하고 status, code만 남긴다.
  }

  return undefined
}

/**
 * 요청 하나당 allowlist field만 담은 JSON 한 줄을 남긴다. URL, query, header, body와
 * 오류 message는 남기지 않고, 5xx 응답에만 정제한 오류 chain을 붙인다. 캐릭터 상세 요청에는
 * 끝난 Neople 단계별 대기 시간과 저장한 응답 본문을 다시 보냈는지만 붙이고, 후보 검색 요청에는
 * 저장한 결과를 보냈는지와 진행 중인 검색에 합류했는지만 붙인다. 응답의 `close` event에서 부른다.
 */
export function writeAccessLogLine(
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
    // 접근 로그의 close listener가 가장 먼저 등록되므로, 예외를 넘기면 process가 끝나고 뒤에 등록된
    // close listener(업로드 slot 해제 등)도 실행되지 않는다. 로그 한 줄만 버린다.
  }
}
