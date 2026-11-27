import type { LabItemPriceTarget } from '@dfragon/database'

export interface LabItemRepository {
  readPriceTargets(): Promise<LabItemPriceTarget[]>
}

export interface LabCandidatePriceRepository {
  readPriceTargets(): Promise<LabItemPriceTarget[]>
  deleteHistoryBefore(before: Date): Promise<number>
}
