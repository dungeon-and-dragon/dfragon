import type { CatalogDetail } from '../../domain/character-catalog/index.js'
import type { CharacterPayload } from '../../domain/character-detail/index.js'

export type FetchCatalog = (
  itemIds: string[],
  signal: AbortSignal
) => Promise<Map<string, CharacterPayload>>

export interface CharacterCatalog {
  load(itemIds: string[], requestSignal: AbortSignal): Promise<Map<string, CatalogDetail>>
  close(): Promise<void>
}
