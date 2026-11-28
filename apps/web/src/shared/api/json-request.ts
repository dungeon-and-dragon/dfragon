import type { KyInstance } from 'ky'
import type { z } from 'zod'
import { SearchHttpFailure } from './api-error'
import {
  assertApiSuccess,
  parseCharacterJson,
  throwCharacterTransportFailure
} from './api-response'

type JsonRequestOptions = {
  method?: 'get' | 'post'
  searchParams?: Record<string, string>
  json?: unknown
  signal?: AbortSignal
  details?: boolean
  timeout?: number
  cache?: RequestCache
}

export function createJsonRequest(
  http: KyInstance,
  apiOrigin: string
): <Schema extends z.ZodType>(
  path: string,
  schema: Schema,
  options?: JsonRequestOptions
) => Promise<z.infer<Schema>> {
  return async (
    path,
    schema,
    { method = 'get', searchParams, json, signal, details = true, timeout, cache } = {}
  ) => {
    try {
      signal?.throwIfAborted()
      const request = http(`${apiOrigin}${path}`, {
        method,
        searchParams,
        json,
        headers: { Accept: 'application/json' },
        signal,
        timeout,
        // ky는 undefined 값도 instance 옵션 위에 덮으므로, 주지 않으면 instance의 cache를 그대로 둔다.
        ...(cache !== undefined && { cache })
      })
      const response = await request
      // ky의 body 메서드만 본문 읽기에도 timeout을 건다. await한 Response의 본문을 직접 읽으면 대기 상한이 없다.
      const body = parseCharacterJson(await request.arrayBuffer())
      assertApiSuccess(response, body, details)
      const parsed = schema.safeParse(body)
      if (!parsed.success) {
        throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
      }
      signal?.throwIfAborted()

      return parsed.data
    } catch (error) {
      throwCharacterTransportFailure(error, signal)
    }
  }
}
