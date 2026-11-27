import type { CatalogDetail } from '@dfragon/server-core/domain/character-catalog/index.js'
import type { CharacterIdentity } from '@dfragon/server-core/domain/character-identity.js'
import type { CharacterScoreSource } from '#application/character-detail/index.js'
import type { LabEnchantSlots } from '#domain/equipment-simulation/index.js'

export type LoadCharacterScoreSource = (
  identity: CharacterIdentity,
  signal: AbortSignal
) => Promise<CharacterScoreSource>

export type LoadItemDetails = (
  itemIds: string[],
  signal: AbortSignal
) => Promise<ReadonlyMap<string, CatalogDetail>>

export type LoadEnchantOptions = (signal: AbortSignal) => Promise<LabEnchantSlots>
