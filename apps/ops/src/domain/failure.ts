export type OpsFailureKind =
  | 'request'
  | 'mediaType'
  | 'jobNotFound'
  | 'jobAlreadyRunning'
  | 'jobNotScheduled'
  | 'batchNeopleKeyNotFound'
  | 'batchNeopleKeyDuplicate'
  | 'labCurrencyNotFound'
  | 'labCurrencyDuplicate'
  | 'internal'

export class OpsFailure extends Error {
  readonly kind: OpsFailureKind

  constructor(kind: OpsFailureKind) {
    super(kind)
    this.name = 'OpsFailure'
    this.kind = kind
  }
}
