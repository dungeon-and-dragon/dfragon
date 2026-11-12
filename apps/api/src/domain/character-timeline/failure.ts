import type { NeopleFailureKind, NeopleKeyShortage, NeopleUpstreamResponse } from '@dfragon/neople'
import { type FailureOptions, SanitizedFailure } from '../error-chain.js'

export type TimelineFailureKind = NeopleFailureKind

export type TimelineFailureOptions = FailureOptions & {
  upstream?: NeopleUpstreamResponse
  keyShortage?: NeopleKeyShortage
}

export class TimelineFailure extends SanitizedFailure {
  readonly kind: TimelineFailureKind
  readonly upstream: NeopleUpstreamResponse | undefined
  readonly keyShortage: NeopleKeyShortage | undefined

  constructor(
    kind: TimelineFailureKind,
    { upstream, keyShortage, ...options }: TimelineFailureOptions = {}
  ) {
    super(`Timeline request failed: ${kind}`, options)
    this.name = 'TimelineFailure'
    this.kind = kind
    this.upstream = upstream
    this.keyShortage = keyShortage
  }
}
