import type { SearchErrorBody } from '../types/neople-character-search.js'
import { type FailureOptions, SanitizedFailure } from '../error-chain.js'

const errors = {
  query: {
    status: 400,
    code: 'INVALID_SEARCH_QUERY',
    message: '검색 조건을 확인해 주세요.'
  },
  internal: {
    status: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: '서버 오류로 검색을 처리하지 못했습니다.'
  },
  api: {
    status: 502,
    code: 'NEOPLE_API_ERROR',
    message: '캐릭터 검색 중 오류가 발생했습니다.'
  },
  unavailable: {
    status: 503,
    code: 'NEOPLE_UNAVAILABLE',
    message: '현재 캐릭터 검색을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.'
  },
  timeout: {
    status: 504,
    code: 'NEOPLE_TIMEOUT',
    message: '캐릭터 검색 응답 시간이 초과됐습니다. 다시 시도해 주세요.'
  }
} as const satisfies Record<string, { status: number; code: string; message: string }>

type NeopleSearchFailureKind = keyof typeof errors

export class NeopleSearchFailure extends SanitizedFailure {
  readonly body: SearchErrorBody
  readonly kind: NeopleSearchFailureKind
  readonly status: (typeof errors)[NeopleSearchFailureKind]['status']

  constructor(kind: NeopleSearchFailureKind, options: FailureOptions = {}) {
    const definition = errors[kind]
    super(definition.message, options)
    this.name = 'NeopleSearchFailure'
    this.kind = kind
    this.status = definition.status
    this.body = { error: { code: definition.code, message: definition.message } }
  }
}
