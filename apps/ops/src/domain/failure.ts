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
  | 'labItemIconNotFound'
  | 'labCandidateNotFound'
  | 'labCandidateSnapshotNotFound'
  | 'labCandidateIconNotFound'
  | 'labCandidateInLabItems'
  | 'internal'

export class OpsFailure extends Error {
  readonly kind: OpsFailureKind

  constructor(kind: OpsFailureKind) {
    super(kind)
    this.name = 'OpsFailure'
    this.kind = kind
  }
}
