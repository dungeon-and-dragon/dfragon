import type {
  AuctionPriceHistoryEntry,
  LabCandidateBatch,
  LabCandidateBatchResult,
  LabCandidateExclusion,
  LabCandidateQuery,
  LabCandidateSummary,
  LabCurrencyIcon
} from '@dfragon/database'

export interface LabCandidateRepository {
  upsert(batch: LabCandidateBatch): Promise<LabCandidateBatchResult>
  saveIcon(itemName: string, icon: LabCurrencyIcon): Promise<{ status: 'updated' | 'notFound' }>
  deleteOtherVersions(versionId: string): Promise<{ remaining: number; deleted: number }>
  readCandidates(query: LabCandidateQuery): Promise<LabCandidateSummary[]>
  readIcon(itemName: string): Promise<LabCurrencyIcon | null>
  readPriceHistory(itemName: string): Promise<AuctionPriceHistoryEntry[]>
  exclude(itemName: string): Promise<{ status: 'excluded' | 'labItem' }>
  include(itemName: string): Promise<void>
  readExclusions(): Promise<LabCandidateExclusion[]>
}
