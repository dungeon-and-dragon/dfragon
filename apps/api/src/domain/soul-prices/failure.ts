import { type FailureOptions, SanitizedFailure } from '@dfragon/lib/error-chain'

export type SoulPriceFailureKind = 'internal' | 'api' | 'unavailable' | 'timeout'

export class SoulPriceFailure extends SanitizedFailure {
  readonly kind: SoulPriceFailureKind

  constructor(kind: SoulPriceFailureKind, options: FailureOptions = {}) {
    super(`Soul price failed: ${kind}`, options)
    this.name = 'SoulPriceFailure'
    this.kind = kind
  }
}

export function soulPriceFailure(error: unknown): SoulPriceFailure {
  if (error instanceof SoulPriceFailure) {
    return error
  }

  return new SoulPriceFailure('internal', { cause: error })
}
