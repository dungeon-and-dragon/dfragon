import {
  type DatabaseClient,
  type LabCurrencyIcon,
  type LabItemPriceRow,
  readLabCurrencyIcon,
  readLabItemDetailIcon,
  readLabItemPrices
} from '@dfragon/database'
import type { LabItemRepository } from '#application/lab-items/repository.js'

export class DatabaseLabItemRepository implements LabItemRepository {
  constructor(private readonly client: DatabaseClient) {}

  readLabItemPrices(): Promise<LabItemPriceRow[]> {
    return readLabItemPrices(this.client)
  }

  readCurrencyIcon(id: number): Promise<LabCurrencyIcon | null> {
    return readLabCurrencyIcon(this.client, id)
  }

  readItemIcon(itemName: string): Promise<LabCurrencyIcon | null> {
    return readLabItemDetailIcon(this.client, itemName)
  }
}
