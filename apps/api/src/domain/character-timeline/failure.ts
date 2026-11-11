import type { NeopleFailureKind, NeopleUpstreamResponse } from '@dfragon/neople'
import { type FailureOptions, SanitizedFailure } from '../error-chain.js'

export type TimelineFailureKind = NeopleFailureKind

export type TimelineFailureOptions = FailureOptions & { upstream?: NeopleUpstreamResponse }

export class TimelineFailure extends SanitizedFailure {
  readonly kind: TimelineFailureKind
  readonly upstream: NeopleUpstreamResponse | undefined

  constructor(kind: TimelineFailureKind, { upstream, ...options }: TimelineFailureOptions = {}) {
    super(`Timeline request failed: ${kind}`, options)
    this.name = 'TimelineFailure'
    this.kind = kind
    this.upstream = upstream
  }
}
