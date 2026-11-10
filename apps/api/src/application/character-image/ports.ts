import type { CharacterIdentity } from '../../domain/character-identity.js'

export type FetchCharacterImage = (
  identity: CharacterIdentity,
  signal: AbortSignal
) => Promise<Buffer>
