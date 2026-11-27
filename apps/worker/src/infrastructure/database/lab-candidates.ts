import {
  type DatabaseClient,
  deleteAuctionPriceHistoryBefore,
  type LabItemPriceTarget,
  readLabCandidatePriceTargets,
  replaceLabCandidateWearCounts
} from '@dfragon/database'
import type { LabCandidatePriceRepository } from '#application/auction-prices/repository.js'
import type { LabCandidateWearCountRepository } from '#application/lab-candidates/repository.js'

export class DatabaseLabCandidatePriceRepository implements LabCandidatePriceRepository {
  constructor(private readonly client: DatabaseClient) {}

  readPriceTargets(): Promise<LabItemPriceTarget[]> {
    return readLabCandidatePriceTargets(this.client)
  }

  deleteHistoryBefore(before: Date): Promise<number> {
    return deleteAuctionPriceHistoryBefore(this.client, before)
  }
}

export class DatabaseLabCandidateWearCountRepository implements LabCandidateWearCountRepository {
  constructor(private readonly client: DatabaseClient) {}

  replaceWearCounts(computedAt: Date): Promise<number> {
    return replaceLabCandidateWearCounts(this.client, computedAt)
  }
}
