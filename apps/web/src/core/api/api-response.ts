import ky, { isTimeoutError } from 'ky'
import { z } from 'zod'
import type { SearchErrorCode } from '../search/search'
import { SearchHttpFailure } from './http'

const failureSchema = z.object({
  error: z.object({ code: z.string(), message: z.string().min(1).optional().catch(undefined) })
})
const statusErrors: Readonly<Partial<Record<number, SearchErrorCode>>> = {
  400: 'INVALID_SEARCH_QUERY',
  429: 'SEARCH_RATE_LIMITED',
  500: 'INTERNAL_SERVER_ERROR',
  502: 'NEOPLE_API_ERROR',
  503: 'NEOPLE_UNAVAILABLE',
  504: 'NEOPLE_TIMEOUT'
}
const detailStatusErrors: Readonly<Partial<Record<number, SearchErrorCode>>> = {
  ...statusErrors,
  404: 'CHARACTER_NOT_FOUND'
}

/** 공개 캐릭터와 캐릭터 이미지 요청은 인증, 리다이렉트, 자체 재시도를 사용하지 않고 ky 기본 timeout까지만 기다린다. */
export function createCharacterHttpClient(transport: typeof fetch): ReturnType<typeof ky.create> {
  return ky.create({
    fetch: transport,
    retry: 0,
    throwHttpErrors: false,
    redirect: 'error',
    credentials: 'omit',
    cache: 'no-store'
  })
}

// Response.text(), .json()과 ky의 parseJson은 잘못된 UTF-8을 U+FFFD로 바꿔 읽으므로 bytes를 fatal 모드로 decode해 거절한다.
export function parseCharacterJson(bytes: ArrayBuffer): unknown {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)

    return JSON.parse(text)
  } catch {
    throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
  }
}

export function throwCharacterTransportFailure(error: unknown, signal?: AbortSignal): never {
  signal?.throwIfAborted()
  if (error instanceof SearchHttpFailure) {
    throw error
  }

  if (isTimeoutError(error)) {
    throw new SearchHttpFailure('SEARCH_TIMEOUT')
  }
  throw new SearchHttpFailure('SEARCH_NETWORK_ERROR')
}

function statusErrorCode(status: number, details: boolean): SearchErrorCode | undefined {
  if (details) {
    return detailStatusErrors[status]
  }

  return statusErrors[status]
}

function expectedErrorCode(status: number, details: boolean): string | undefined {
  if (details && status === 400) {
    return 'INVALID_CHARACTER_QUERY'
  }

  if (details && status === 429) {
    return 'CHARACTER_RATE_LIMITED'
  }

  return statusErrorCode(status, details)
}

export function assertApiSuccess(response: Response, body: unknown, details: boolean): void {
  if (response.status === 200) {
    if (body != null && typeof body === 'object' && Object.hasOwn(body, 'error')) {
      throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
    }

    return
  }
  const code = statusErrorCode(response.status, details)
  const expectedCode = expectedErrorCode(response.status, details)
  const failure = failureSchema.safeParse(body)
  if (!code || !failure.success || failure.data.error.code !== expectedCode) {
    throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
  }
  throw new SearchHttpFailure(code, failure.data.error.message)
}
