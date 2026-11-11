import { isRecord } from '@dfragon/lib/utils/shape-check'

export type NeopleUpstreamFailureKind = 'internal' | 'api' | 'unavailable'

export type NeopleFailureKind = NeopleUpstreamFailureKind | 'timeout'

// Neople 결과 코드표(https://developers.neople.co.kr/contents/guide/pages/code)의 공통, 던전앤파이터 code를 모두 둔다.
const upstreamCodeErrors = new Map<string, NeopleUpstreamFailureKind>([
  ['API000', 'internal'],
  ['API001', 'api'],
  ['API002', 'unavailable'],
  ['API003', 'internal'],
  ['API004', 'internal'],
  ['API005', 'internal'],
  ['API006', 'api'],
  ['API007', 'api'],
  ['API008', 'unavailable'],
  ['API900', 'api'],
  ['API901', 'api'],
  ['API999', 'api'],
  ['DNF000', 'api'],
  ['DNF001', 'api'],
  ['DNF003', 'api'],
  ['DNF004', 'api'],
  ['DNF005', 'api'],
  ['DNF006', 'api'],
  ['DNF007', 'api'],
  ['DNF008', 'api'],
  ['DNF009', 'api'],
  ['DNF900', 'api'],
  ['DNF901', 'api'],
  ['DNF980', 'unavailable'],
  ['DNF999', 'api']
])

const CHARACTER_NOT_FOUND_CODE = 'DNF001'

// 응답 본문의 다른 값이 로그로 나가지 않게 결과 코드표의 모양(영문 3자와 숫자 3자)일 때만 code로 본다.
const UPSTREAM_CODE_PATTERN = /^[A-Z]{3}\d{3}$/

export type NeopleUpstreamResponse = {
  status: number
  code: string | undefined
}

interface NeopleRequestFailureOptions extends ErrorOptions {
  characterNotFound?: boolean
  upstream?: NeopleUpstreamResponse
}

/**
 * `cause`에 정제하지 않은 원래 오류가 남으므로 응답이나 로그로 그대로 내보내지 않는다.
 * 호출한 쪽이 자기 오류로 바꿀 때 `kind`와 원인만 넘긴다.
 */
export class NeopleRequestFailure extends Error {
  readonly kind: NeopleFailureKind
  // DNF001이어도 kind는 그대로 두어 검색, 타임라인, 수집이 쓰는 분류를 바꾸지 않는다.
  readonly characterNotFound: boolean
  readonly upstream: NeopleUpstreamResponse | undefined

  constructor(
    kind: NeopleFailureKind,
    { characterNotFound = false, upstream, ...options }: NeopleRequestFailureOptions = {}
  ) {
    super(`Neople request failed: ${kind}`, options)
    this.name = 'NeopleRequestFailure'
    this.kind = kind
    this.characterNotFound = characterNotFound
    this.upstream = upstream
  }
}

export function neopleStatusFailureKind(status: number): NeopleUpstreamFailureKind {
  if (status === 429 || status === 503) {
    return 'unavailable'
  }

  return 'api'
}

export function classifyNeopleUpstreamFailure(
  body: unknown,
  status: number,
  ok: boolean
): NeopleUpstreamFailureKind | undefined {
  if (!isRecord(body) || !Object.hasOwn(body, 'error')) {
    if (ok) {
      return undefined
    }

    return neopleStatusFailureKind(status)
  }

  const code = upstreamErrorCode(body)
  const knownError = typeof code === 'string' ? upstreamCodeErrors.get(code) : undefined

  if (knownError !== undefined) {
    return knownError
  }

  return neopleStatusFailureKind(status)
}

export function toUpstreamResponse(body: unknown, status: number): NeopleUpstreamResponse {
  const code = upstreamErrorCode(body)
  if (typeof code === 'string' && UPSTREAM_CODE_PATTERN.test(code)) {
    return { status, code }
  }

  return { status, code: undefined }
}

export function isCharacterNotFound(body: unknown): boolean {
  return upstreamErrorCode(body) === CHARACTER_NOT_FOUND_CODE
}

function upstreamErrorCode(body: unknown): unknown {
  if (!isRecord(body) || !isRecord(body.error)) {
    return undefined
  }

  return body.error.code
}
