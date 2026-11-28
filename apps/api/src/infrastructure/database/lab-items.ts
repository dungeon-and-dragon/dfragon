import {
  type DatabaseClient,
  type LabCurrencyIcon,
  type LabItemPriceRow,
  readLabCandidateIcon,
  readLabCurrencyIcon,
  readLabItemDetailIcon,
  readLabItemPrices,
  readMostWornItemIds,
  type WornItemId
} from '@dfragon/database'
import type { LabItemRepository } from '#application/lab-items/repository.js'

export class DatabaseLabItemRepository implements LabItemRepository {
  constructor(private readonly client: DatabaseClient) {}

  readLabItemPrices(): Promise<LabItemPriceRow[]> {
    return readLabItemPrices(this.client)
  }

  readMostWornItemIds(itemNames: readonly string[]): Promise<WornItemId[]> {
    return readMostWornItemIds(this.client, itemNames)
  }

  readCurrencyIcon(id: number): Promise<LabCurrencyIcon | null> {
    return readLabCurrencyIcon(this.client, id)
  }

  async readItemIcon(itemName: string): Promise<LabCurrencyIcon | null> {
    const ownerIcon = await readLabItemDetailIcon(this.client, itemName)

    if (ownerIcon !== null) {
      return ownerIcon
    }

    return readLabCandidateIcon(this.client, itemName)
  }
}
