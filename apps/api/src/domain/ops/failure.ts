export type OpsFailureKind =
  | 'request'
  | 'mediaType'
  | 'jobNotFound'
  | 'jobAlreadyRunning'
  | 'jobNotScheduled'
  | 'internal'

export class OpsFailure extends Error {
  readonly kind: OpsFailureKind

  constructor(kind: OpsFailureKind) {
    super(kind)
    this.name = 'OpsFailure'
    this.kind = kind
  }
}
