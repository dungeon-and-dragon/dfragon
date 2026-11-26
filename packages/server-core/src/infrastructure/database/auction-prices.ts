import { type AuctionPriceEntry, type DatabaseClient, recordAuctionPrice } from '@dfragon/database'
import type { AuctionPriceRepository } from '#application/auction-prices/repository.js'

export class DatabaseAuctionPriceRepository implements AuctionPriceRepository {
  constructor(private readonly client: DatabaseClient) {}

  record(entry: AuctionPriceEntry): Promise<void> {
    return recordAuctionPrice(this.client, entry)
  }
}
