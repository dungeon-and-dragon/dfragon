import { type OpsFailureKind, OpsFailure } from '../../domain/ops/failure.js'
import type { FailureResponse } from './failure-response.js'

const failureResponses = {
  request: { status: 400, body: { error: { code: 'INVALID_OPS_REQUEST' } } },
  mediaType: { status: 415, body: { error: { code: 'UNSUPPORTED_MEDIA_TYPE' } } },
  jobNotFound: { status: 404, body: { error: { code: 'JOB_NOT_FOUND' } } },
  jobAlreadyRunning: { status: 409, body: { error: { code: 'JOB_ALREADY_RUNNING' } } },
  jobNotScheduled: { status: 400, body: { error: { code: 'JOB_NOT_SCHEDULED' } } },
  batchNeopleKeyNotFound: { status: 404, body: { error: { code: 'BATCH_NEOPLE_KEY_NOT_FOUND' } } },
  batchNeopleKeyDuplicate: { status: 409, body: { error: { code: 'BATCH_NEOPLE_KEY_DUPLICATE' } } },
  internal: { status: 500, body: { error: { code: 'INTERNAL_SERVER_ERROR' } } }
} as const satisfies Record<OpsFailureKind, FailureResponse>

export function opsFailureResponse(error: unknown): FailureResponse {
  if (error instanceof OpsFailure) {
    return failureResponses[error.kind]
  }

  return failureResponses.internal
}
