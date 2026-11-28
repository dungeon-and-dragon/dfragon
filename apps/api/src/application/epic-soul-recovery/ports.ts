import type { CharacterIdentity } from '@dfragon/server-core/domain/character-identity.js'
import type { CharacterScoreSource } from '#application/character-detail/index.js'

export type LoadStoredScoreSource = (
  identity: CharacterIdentity,
  signal: AbortSignal
) => Promise<CharacterScoreSource | null>
