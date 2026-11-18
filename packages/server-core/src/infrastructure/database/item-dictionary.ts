import {
  type DatabaseClient,
  type ItemDictionaryEntry,
  readUnlistedItemIds,
  recordItemDictionary
} from '@dfragon/database'
import type { ItemDictionaryRepository } from '#application/item-dictionary/repository.js'

export class DatabaseItemDictionaryRepository implements ItemDictionaryRepository {
  constructor(private readonly client: DatabaseClient) {}

  readUnlistedItemIds(itemIds: readonly string[]): Promise<string[]> {
    return readUnlistedItemIds(this.client, itemIds)
  }

  record(entries: readonly ItemDictionaryEntry[]): Promise<void> {
    return recordItemDictionary(this.client, entries)
  }
}
