import type { ItemDictionaryEntry } from '@dfragon/database'

export interface ItemDictionaryRepository {
  readUnlistedItemIds(itemIds: readonly string[]): Promise<string[]>
  record(entries: readonly ItemDictionaryEntry[]): Promise<void>
}
