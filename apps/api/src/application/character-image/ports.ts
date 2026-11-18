import type { CharacterIdentity } from '@dfragon/server-core/domain/character-identity.js'

export type FetchCharacterImage = (
  identity: CharacterIdentity,
  signal: AbortSignal
) => Promise<Buffer<ArrayBuffer>>
