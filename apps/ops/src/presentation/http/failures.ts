import type { FailureResponse } from '@dfragon/http-server'
import { type OpsFailureKind, OpsFailure } from '#domain/failure.js'

const failureResponses = {
  request: { status: 400, body: { error: { code: 'INVALID_OPS_REQUEST' } } },
  mediaType: { status: 415, body: { error: { code: 'UNSUPPORTED_MEDIA_TYPE' } } },
  jobNotFound: { status: 404, body: { error: { code: 'JOB_NOT_FOUND' } } },
  jobAlreadyRunning: { status: 409, body: { error: { code: 'JOB_ALREADY_RUNNING' } } },
  jobNotScheduled: { status: 400, body: { error: { code: 'JOB_NOT_SCHEDULED' } } },
  batchNeopleKeyNotFound: { status: 404, body: { error: { code: 'BATCH_NEOPLE_KEY_NOT_FOUND' } } },
  batchNeopleKeyDuplicate: { status: 409, body: { error: { code: 'BATCH_NEOPLE_KEY_DUPLICATE' } } },
  labCurrencyNotFound: { status: 404, body: { error: { code: 'LAB_CURRENCY_NOT_FOUND' } } },
  labCurrencyDuplicate: { status: 409, body: { error: { code: 'LAB_CURRENCY_DUPLICATE' } } },
  labItemIconNotFound: { status: 404, body: { error: { code: 'LAB_ITEM_ICON_NOT_FOUND' } } },
  labCandidateNotFound: { status: 404, body: { error: { code: 'LAB_CANDIDATE_NOT_FOUND' } } },
  labCandidateSnapshotNotFound: {
    status: 404,
    body: { error: { code: 'LAB_CANDIDATE_SNAPSHOT_NOT_FOUND' } }
  },
  labCandidateIconNotFound: {
    status: 404,
    body: { error: { code: 'LAB_CANDIDATE_ICON_NOT_FOUND' } }
  },
  internal: { status: 500, body: { error: { code: 'INTERNAL_SERVER_ERROR' } } }
} as const satisfies Record<OpsFailureKind, FailureResponse>

export function opsFailureResponse(error: unknown): FailureResponse {
  if (error instanceof OpsFailure) {
    return failureResponses[error.kind]
  }

  return failureResponses.internal
}
