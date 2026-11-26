import {
  type DatabaseClient,
  type LabItemPriceTarget,
  readLabItemPriceTargets
} from '@dfragon/database'
import type { LabItemRepository } from '#application/auction-prices/repository.js'

export class DatabaseLabItemRepository implements LabItemRepository {
  constructor(private readonly client: DatabaseClient) {}

  readPriceTargets(): Promise<LabItemPriceTarget[]> {
    return readLabItemPriceTargets(this.client)
  }
}
