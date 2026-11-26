import { type DatabaseClient, type LabItemPriceRow, readLabItemPrices } from '@dfragon/database'
import type { LabItemRepository } from '#application/lab-items/repository.js'

export class DatabaseLabItemRepository implements LabItemRepository {
  constructor(private readonly client: DatabaseClient) {}

  readLabItemPrices(): Promise<LabItemPriceRow[]> {
    return readLabItemPrices(this.client)
  }
}
