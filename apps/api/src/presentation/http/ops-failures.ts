import { HttpException } from '@nestjs/common'
import { type OpsFailureKind, OpsFailure } from '../../domain/ops/failure.js'
import type { FailureResponse } from './failure-response.js'

const failureResponses = {
  request: { status: 400, body: { error: { code: 'INVALID_OPS_REQUEST' } } },
  mediaType: { status: 415, body: { error: { code: 'UNSUPPORTED_MEDIA_TYPE' } } },
  jobNotFound: { status: 404, body: { error: { code: 'JOB_NOT_FOUND' } } },
  jobAlreadyRunning: { status: 409, body: { error: { code: 'JOB_ALREADY_RUNNING' } } },
  jobNotScheduled: { status: 400, body: { error: { code: 'JOB_NOT_SCHEDULED' } } },
  internal: { status: 500, body: { error: { code: 'INTERNAL_SERVER_ERROR' } } }
} as const satisfies Record<OpsFailureKind, FailureResponse>

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
    return failureResponses[error.kind]
  }

  const kind = isClientError(error) ? 'request' : 'internal'

  return failureResponses[kind]
}

export function unsupportedOpsMediaType(): OpsFailure {
  return new OpsFailure('mediaType')
}
