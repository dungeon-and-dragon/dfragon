import type { NeopleUpstreamFailureKind } from '../../errors/neople-search.js'
import { type FailureOptions, SanitizedFailure } from '../../error-chain.js'

export type TimelineFailureKind = NeopleUpstreamFailureKind | 'timeout'

export class TimelineFailure extends SanitizedFailure {
  readonly kind: TimelineFailureKind

  constructor(kind: TimelineFailureKind, options: FailureOptions = {}) {
    super('캐릭터 타임라인을 받지 못했습니다.', options)
    this.name = 'TimelineFailure'
    this.kind = kind
  }
}
