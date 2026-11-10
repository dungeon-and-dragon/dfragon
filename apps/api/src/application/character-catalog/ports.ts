import type { CharacterPayload } from '../../domain/character-detail/sections.js'

export type FetchCatalog = (
  itemIds: string[],
  signal: AbortSignal
) => Promise<Map<string, CharacterPayload>>
