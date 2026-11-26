import type { LabItemPriceRow } from '@dfragon/database'

export interface LabItemRepository {
  readLabItemPrices(): Promise<LabItemPriceRow[]>
}
