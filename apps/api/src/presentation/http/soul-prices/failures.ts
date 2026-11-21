import type { FailureResponse } from '@dfragon/http-server'
import { type SoulPriceFailureKind, soulPriceFailure } from '#domain/soul-prices/index.js'

const failureResponses: Record<SoulPriceFailureKind, FailureResponse> = {
  internal: {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '서버 오류로 소울 결정 가격을 처리하지 못했습니다.'
      }
    }
  },
  api: {
    status: 502,
    body: {
      error: { code: 'NEOPLE_API_ERROR', message: '소울 결정 가격 조회 중 오류가 발생했습니다.' }
    }
  },
  unavailable: {
    status: 503,
    body: {
      error: {
        code: 'NEOPLE_UNAVAILABLE',
        message: '현재 소울 결정 가격을 조회할 수 없습니다. 잠시 후 다시 시도해 주세요.'
      }
    }
  },
  timeout: {
    status: 504,
    body: {
      error: {
        code: 'NEOPLE_TIMEOUT',
        message: '소울 결정 가격 조회 시간이 초과됐습니다. 다시 시도해 주세요.'
      }
    }
  }
}

export function soulPriceFailureResponse(error: unknown): FailureResponse {
  return failureResponses[soulPriceFailure(error).kind]
}
