import { type DatabaseClient, readUnlistedAcquisitionItemIds } from '@dfragon/database'
import {
  ITEM_DICTIONARY_CODES,
  ITEM_DICTIONARY_RARITIES
} from '@dfragon/server-core/domain/item-dictionary/index.js'
import type { AcquisitionItemRepository } from '#application/item-dictionary/repository.js'

export class DatabaseAcquisitionItemRepository implements AcquisitionItemRepository {
  constructor(private readonly client: DatabaseClient) {}

  readUnlistedItemIds(since: Date): Promise<string[]> {
    return readUnlistedAcquisitionItemIds(this.client, {
      codes: ITEM_DICTIONARY_CODES,
      itemRarities: ITEM_DICTIONARY_RARITIES,
      since
    })
  }
}
