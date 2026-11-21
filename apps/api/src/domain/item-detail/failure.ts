import { type FailureOptions, SanitizedFailure } from '@dfragon/lib/error-chain'

export type ItemDetailFailureKind = 'query' | 'internal' | 'api'

export class ItemDetailFailure extends SanitizedFailure {
  readonly kind: ItemDetailFailureKind

  constructor(kind: ItemDetailFailureKind, options: FailureOptions = {}) {
    super(`Item detail failed: ${kind}`, options)
    this.name = 'ItemDetailFailure'
    this.kind = kind
  }
}

export function itemDetailFailure(error: unknown): ItemDetailFailure {
  if (error instanceof ItemDetailFailure) {
    return error
  }

  return new ItemDetailFailure('internal', { cause: error })
}
