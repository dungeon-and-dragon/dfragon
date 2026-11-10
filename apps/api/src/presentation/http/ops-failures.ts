import { HttpException } from '@nestjs/common'
import { OpsFailure } from '../../ops/errors.js'
import type { FailureResponse } from './failure-response.js'

function isClientError(error: unknown): boolean {
  if (error instanceof HttpException) {
    return error.getStatus() < 500
  }

  // body-parser는 본문 크기, 인코딩 거절을 HttpException이 아닌 http-errors 오류로 넘긴다.
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return false
  }
  const { status } = error

  return typeof status === 'number' && status >= 400 && status < 500
}

export function opsFailureResponse(error: unknown): FailureResponse {
  if (error instanceof OpsFailure) {
    return error
  }

  const kind = isClientError(error) ? 'request' : 'internal'

  return new OpsFailure(kind)
}

export function unsupportedOpsMediaType(): OpsFailure {
  return new OpsFailure('mediaType')
}
