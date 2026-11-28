import type { LabCurrencyIcon, LabItemPriceRow, WornItemId } from '@dfragon/database'

export interface LabItemRepository {
  readLabItemPrices(): Promise<LabItemPriceRow[]>
  readCurrencyIcon(id: number): Promise<LabCurrencyIcon | null>
  readItemIcon(itemName: string): Promise<LabCurrencyIcon | null>
  readMostWornItemIds(itemNames: readonly string[]): Promise<WornItemId[]>
}
