import type { CharacterPayload } from '#domain/character-detail/index.js'

export type FetchItemDetails = (itemIds: string[]) => Promise<ReadonlyMap<string, CharacterPayload>>
