import { type DatabaseClient, readUnlistedAcquisitionItemIds } from '@dfragon/database'
import {
  EQUIPMENT_ACQUISITION_CODES,
  ITEM_DICTIONARY_RARITIES,
  OATH_ACQUISITION_CODES
} from '@dfragon/server-core/domain/item-dictionary/index.js'
import type { AcquisitionItemRepository } from '#application/item-dictionary/repository.js'

export class DatabaseAcquisitionItemRepository implements AcquisitionItemRepository {
  constructor(private readonly client: DatabaseClient) {}

  readUnlistedItemIds(since: Date): Promise<string[]> {
    return readUnlistedAcquisitionItemIds(this.client, {
      equipmentCodes: EQUIPMENT_ACQUISITION_CODES,
      equipmentRarities: ITEM_DICTIONARY_RARITIES,
      oathCodes: OATH_ACQUISITION_CODES,
      since
    })
  }
}
