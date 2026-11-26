import type { LabItemPriceTarget } from '@dfragon/database'

export interface LabItemRepository {
  readPriceTargets(): Promise<LabItemPriceTarget[]>
}
