import { type FailureOptions, SanitizedFailure } from '@dfragon/lib/error-chain'

export type CharacterSearchFailureKind = 'query' | 'internal' | 'api' | 'unavailable' | 'timeout'

export class NeopleSearchFailure extends SanitizedFailure {
  readonly kind: CharacterSearchFailureKind

  constructor(kind: CharacterSearchFailureKind, options: FailureOptions = {}) {
    super(`Character search failed: ${kind}`, options)
    this.name = 'NeopleSearchFailure'
    this.kind = kind
  }
}
