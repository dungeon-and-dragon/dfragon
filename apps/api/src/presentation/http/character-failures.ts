import {
  type CharacterFailureKind,
  characterDetailFailure
} from '../../domain/character-failure.js'
import type { FailureResponse } from './failure-response.js'

const failureResponses: Record<CharacterFailureKind, FailureResponse> = {
  query: {
    status: 400,
    body: {
      error: { code: 'INVALID_CHARACTER_QUERY', message: '캐릭터 조회 조건을 확인해 주세요.' }
    }
  },
  notFound: {
    status: 404,
    body: {
      error: {
        code: 'CHARACTER_NOT_FOUND',
        message: '캐릭터를 찾을 수 없습니다. 서버와 캐릭터 ID를 확인해 주세요.'
      }
    }
  },
  internal: {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '서버 오류로 캐릭터 정보를 처리하지 못했습니다.'
      }
    }
  },
  api: {
    status: 502,
    body: {
      error: { code: 'NEOPLE_API_ERROR', message: '캐릭터 정보 조회 중 오류가 발생했습니다.' }
    }
  },
  unavailable: {
    status: 503,
    body: {
      error: {
        code: 'NEOPLE_UNAVAILABLE',
        message: '현재 캐릭터 정보를 조회할 수 없습니다. 잠시 후 다시 시도해 주세요.'
      }
    }
  },
  timeout: {
    status: 504,
    body: {
      error: {
        code: 'NEOPLE_TIMEOUT',
        message: '캐릭터 정보 조회 시간이 초과됐습니다. 다시 시도해 주세요.'
      }
    }
  }
}

export function characterFailureResponse(error: unknown): FailureResponse {
  return failureResponses[characterDetailFailure(error).kind]
}
