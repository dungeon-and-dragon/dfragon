import {
  type DatabaseClient,
  deleteAuctionPriceHistoryBefore,
  type LabItemPriceTarget,
  readLabCandidatePriceTargets
} from '@dfragon/database'
import type { LabCandidatePriceRepository } from '#application/auction-prices/candidate-repository.js'

export class DatabaseLabCandidatePriceRepository implements LabCandidatePriceRepository {
  constructor(private readonly client: DatabaseClient) {}

  readPriceTargets(): Promise<LabItemPriceTarget[]> {
    return readLabCandidatePriceTargets(this.client)
  }

  deleteHistoryBefore(before: Date): Promise<number> {
    return deleteAuctionPriceHistoryBefore(this.client, before)
  }
}
