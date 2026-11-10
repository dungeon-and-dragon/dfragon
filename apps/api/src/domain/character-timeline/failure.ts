import type { NeopleFailureKind } from '@dfragon/neople'
import { type FailureOptions, SanitizedFailure } from '../error-chain.js'

export type TimelineFailureKind = NeopleFailureKind

export class TimelineFailure extends SanitizedFailure {
  readonly kind: TimelineFailureKind

  constructor(kind: TimelineFailureKind, options: FailureOptions = {}) {
    super(`Timeline request failed: ${kind}`, options)
    this.name = 'TimelineFailure'
    this.kind = kind
  }
}
