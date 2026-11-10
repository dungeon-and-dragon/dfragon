const failures = {
  request: { status: 400, code: 'INVALID_OPS_REQUEST' },
  mediaType: { status: 415, code: 'UNSUPPORTED_MEDIA_TYPE' },
  jobNotFound: { status: 404, code: 'JOB_NOT_FOUND' },
  jobAlreadyRunning: { status: 409, code: 'JOB_ALREADY_RUNNING' },
  jobNotScheduled: { status: 400, code: 'JOB_NOT_SCHEDULED' },
  internal: { status: 500, code: 'INTERNAL_SERVER_ERROR' }
} as const

export class OpsFailure extends Error {
  readonly status: number
  readonly body: { error: { code: string } }

  constructor(kind: keyof typeof failures) {
    const { status, code } = failures[kind]
    super(code)
    this.name = 'OpsFailure'
    this.status = status
    this.body = { error: { code } }
  }
}
