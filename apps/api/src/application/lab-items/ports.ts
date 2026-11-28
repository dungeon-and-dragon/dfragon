import type { CatalogDetail } from '@dfragon/server-core/domain/character-catalog/index.js'

export type LoadItemDetails = (
  itemIds: string[],
  signal: AbortSignal
) => Promise<ReadonlyMap<string, CatalogDetail>>

export interface FoundGameItem {
  itemId: string
  itemRarity: string
}

/** 이름이 정확히 같은 Neople 아이템을 찾고, 없으면 null이다. */
export type FindGameItem = (itemName: string) => Promise<FoundGameItem | null>
