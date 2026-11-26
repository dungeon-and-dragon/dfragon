import type { AuctionPriceEntry } from '@dfragon/database'

export interface AuctionPriceRepository {
  record(entry: AuctionPriceEntry): Promise<void>
}
