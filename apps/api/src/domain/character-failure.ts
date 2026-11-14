import { type FailureOptions, SanitizedFailure } from '@dfragon/lib/error-chain'
import { NeopleSearchFailure } from './character-search/failure.js'

export type CharacterFailureKind =
  | 'query'
  | 'notFound'
  | 'internal'
  | 'api'
  | 'unavailable'
  | 'timeout'

export class CharacterDetailFailure extends SanitizedFailure {
  readonly kind: CharacterFailureKind

  constructor(kind: CharacterFailureKind, options: FailureOptions = {}) {
    super(`Character request failed: ${kind}`, options)
    this.name = 'CharacterDetailFailure'
    this.kind = kind
  }
}

export function characterDetailFailure(error: unknown): CharacterDetailFailure {
  if (error instanceof CharacterDetailFailure) {
    return error
  }

  if (error instanceof NeopleSearchFailure) {
    // 상세 경로에는 검색 입력이 없으므로 검색 query 오류는 상세 입력 오류가 아닌 내부 오류다.
    const kind = error.kind === 'query' ? 'internal' : error.kind

    return new CharacterDetailFailure(kind, { cause: error })
  }

  return new CharacterDetailFailure('internal', { cause: error })
}
