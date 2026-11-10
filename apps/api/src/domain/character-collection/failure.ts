export type CharacterCollectionFailureKind = 'internal' | 'api' | 'unavailable' | 'timeout'

export class CharacterCollectionFailure extends Error {
  constructor(readonly kind: CharacterCollectionFailureKind) {
    super(`Character collection request failed: ${kind}`)
    this.name = 'CharacterCollectionFailure'
  }
}
