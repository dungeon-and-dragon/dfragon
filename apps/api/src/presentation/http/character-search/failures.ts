import {
  type CharacterSearchFailureKind,
  NeopleSearchFailure
} from '../../../domain/character-search/failure.js'
import type { FailureResponse } from '../failure-response.js'

const failureResponses: Record<CharacterSearchFailureKind, FailureResponse> = {
  query: {
    status: 400,
    body: { error: { code: 'INVALID_SEARCH_QUERY', message: '검색 조건을 확인해 주세요.' } }
  },
  internal: {
    status: 500,
    body: {
      error: { code: 'INTERNAL_SERVER_ERROR', message: '서버 오류로 검색을 처리하지 못했습니다.' }
    }
  },
  api: {
    status: 502,
    body: { error: { code: 'NEOPLE_API_ERROR', message: '캐릭터 검색 중 오류가 발생했습니다.' } }
  },
  unavailable: {
    status: 503,
    body: {
      error: {
        code: 'NEOPLE_UNAVAILABLE',
        message: '현재 캐릭터 검색을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.'
      }
    }
  },
  timeout: {
    status: 504,
    body: {
      error: {
        code: 'NEOPLE_TIMEOUT',
        message: '캐릭터 검색 응답 시간이 초과됐습니다. 다시 시도해 주세요.'
      }
    }
  }
}

export function characterSearchFailureResponse(error: unknown): FailureResponse {
  const kind = error instanceof NeopleSearchFailure ? error.kind : 'internal'

  return failureResponses[kind]
}
