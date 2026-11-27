import type { CatalogDetail } from '@dfragon/server-core/domain/character-catalog/index.js'

export type LoadItemDetails = (
  itemIds: string[],
  signal: AbortSignal
) => Promise<ReadonlyMap<string, CatalogDetail>>
