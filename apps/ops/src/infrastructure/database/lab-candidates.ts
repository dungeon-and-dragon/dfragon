import {
  type AuctionPriceHistoryEntry,
  type DatabaseClient,
  type LabCandidateBatch,
  type LabCandidateBatchResult,
  type LabCandidateExclusion,
  type LabCandidateQuery,
  type LabCandidateSummary,
  type LabCurrencyIcon,
  deleteLabCandidatesOtherVersions,
  excludeLabCandidate,
  includeLabCandidate,
  readAuctionPriceHistory,
  readLabCandidateExclusions,
  readLabCandidateIcon,
  readLabCandidates,
  saveLabCandidateIcon,
  upsertLabCandidates
} from '@dfragon/database'
import type { LabCandidateRepository } from '#application/lab-candidates/repository.js'

export class DatabaseLabCandidateRepository implements LabCandidateRepository {
  constructor(private readonly client: DatabaseClient) {}

  upsert(batch: LabCandidateBatch): Promise<LabCandidateBatchResult> {
    return upsertLabCandidates(this.client, batch)
  }

  saveIcon(itemName: string, icon: LabCurrencyIcon): Promise<{ status: 'updated' | 'notFound' }> {
    return saveLabCandidateIcon(this.client, itemName, icon)
  }

  deleteOtherVersions(versionId: string): Promise<{ remaining: number; deleted: number }> {
    return deleteLabCandidatesOtherVersions(this.client, versionId)
  }

  readCandidates(query: LabCandidateQuery): Promise<LabCandidateSummary[]> {
    return readLabCandidates(this.client, query)
  }

  readIcon(itemName: string): Promise<LabCurrencyIcon | null> {
    return readLabCandidateIcon(this.client, itemName)
  }

  readPriceHistory(itemName: string): Promise<AuctionPriceHistoryEntry[]> {
    return readAuctionPriceHistory(this.client, itemName)
  }

  exclude(itemName: string): Promise<{ status: 'excluded' | 'labItem' }> {
    return excludeLabCandidate(this.client, itemName)
  }

  include(itemName: string): Promise<void> {
    return includeLabCandidate(this.client, itemName)
  }

  readExclusions(): Promise<LabCandidateExclusion[]> {
    return readLabCandidateExclusions(this.client)
  }
}
