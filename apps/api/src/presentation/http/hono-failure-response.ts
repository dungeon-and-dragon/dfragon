import type { Context, MiddlewareHandler } from 'hono'
import type { FailureResponse } from './failure-response.js'
import {
  type AccessLogEnv,
  recordAccessLogErrorChain,
  recordAccessLogErrorCode
} from './hono-access-log.js'

export function sendFailureResponse(
  c: Context<AccessLogEnv>,
  error: unknown,
  failure: FailureResponse
): Response {
  recordAccessLogErrorCode(c, failure.body.error.code)
  recordAccessLogErrorChain(c, error)

  return c.json(failure.body, failure.status)
}

export type FailureHandler = (error: unknown, c: Context<AccessLogEnv>) => Response

export function createFailureHandler(
  toFailureResponse: (error: unknown) => FailureResponse
): FailureHandler {
  return (error, c) => sendFailureResponse(c, error, toFailureResponse(error))
}

/**
 * Hono는 Error가 아닌 값이 던져지면 `onError`를 부르지 않고 요청 처리 전체를 reject한다.
 * 그 값도 같은 실패 응답으로 바꾼다.
 */
export function respondToThrownValues(handle: FailureHandler): MiddlewareHandler<AccessLogEnv> {
  return async (c, next) => {
    try {
      await next()
    } catch (error) {
      c.res = handle(error, c)
    }
  }
}

export function notFoundResponse(c: Context): Response {
  return c.json({ statusCode: 404, message: 'Not Found' }, 404)
}
