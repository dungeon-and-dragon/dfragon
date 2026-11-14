import type { FailureResponse } from '@dfragon/http-server'
import {
  type TodayGradeFailureKind,
  todayGradeFailure
} from '../../../domain/today-grade/failure.js'

const failureResponses: Record<TodayGradeFailureKind, FailureResponse> = {
  internal: {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '서버 오류로 오늘의 등급을 처리하지 못했습니다.'
      }
    }
  },
  api: {
    status: 502,
    body: {
      error: { code: 'NEOPLE_API_ERROR', message: '오늘의 등급 조회 중 오류가 발생했습니다.' }
    }
  },
  unavailable: {
    status: 503,
    body: {
      error: {
        code: 'NEOPLE_UNAVAILABLE',
        message: '현재 오늘의 등급을 조회할 수 없습니다. 잠시 후 다시 시도해 주세요.'
      }
    }
  },
  timeout: {
    status: 504,
    body: {
      error: {
        code: 'NEOPLE_TIMEOUT',
        message: '오늘의 등급 조회 시간이 초과됐습니다. 다시 시도해 주세요.'
      }
    }
  }
}

export function todayGradeFailureResponse(error: unknown): FailureResponse {
  return failureResponses[todayGradeFailure(error).kind]
}
