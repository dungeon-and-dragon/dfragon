import { isRecord } from '@dfragon/lib/utils/shape-check'

export type NeopleUpstreamFailureKind = 'internal' | 'api' | 'unavailable'

export type NeopleFailureKind = NeopleUpstreamFailureKind | 'timeout'

const upstreamCodeErrors = new Map<string, NeopleUpstreamFailureKind>([
  ['API000', 'internal'],
  ['API003', 'internal'],
  ['API004', 'internal'],
  ['API005', 'internal'],
  ['API002', 'unavailable'],
  ['API008', 'unavailable'],
  ['DNF980', 'unavailable'],
  ['API901', 'api'],
  ['DNF901', 'api'],
  ['DNF000', 'api'],
  ['API006', 'api'],
  ['API007', 'api'],
  ['API900', 'api'],
  ['API999', 'api'],
  ['DNF999', 'api']
])

/**
 * `cause`에 정제하지 않은 원래 오류가 남으므로 응답이나 로그로 그대로 내보내지 않는다.
 * 호출한 쪽이 자기 오류로 바꿀 때 `kind`와 원인만 넘긴다.
 */
export class NeopleRequestFailure extends Error {
  readonly kind: NeopleFailureKind

  constructor(kind: NeopleFailureKind, options?: ErrorOptions) {
    super(`Neople request failed: ${kind}`, options)
    this.name = 'NeopleRequestFailure'
    this.kind = kind
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

  const code = isRecord(body.error) ? body.error.code : undefined
  const knownError = typeof code === 'string' ? upstreamCodeErrors.get(code) : undefined

  if (knownError !== undefined) {
    return knownError
  }

  return neopleStatusFailureKind(status)
}
