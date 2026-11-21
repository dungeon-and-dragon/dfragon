import type { FailureResponse } from '@dfragon/http-server'
import { type ItemDetailFailureKind, itemDetailFailure } from '#domain/item-detail/index.js'

const failureResponses: Record<ItemDetailFailureKind, FailureResponse> = {
  query: {
    status: 400,
    body: {
      error: { code: 'INVALID_ITEM_QUERY', message: '아이템 ID를 확인해 주세요.' }
    }
  },
  internal: {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '서버 오류로 아이템 정보를 처리하지 못했습니다.'
      }
    }
  },
  api: {
    status: 502,
    body: {
      error: { code: 'NEOPLE_API_ERROR', message: '아이템 정보 조회 중 오류가 발생했습니다.' }
    }
  }
}

export function itemDetailFailureResponse(error: unknown): FailureResponse {
  return failureResponses[itemDetailFailure(error).kind]
}
