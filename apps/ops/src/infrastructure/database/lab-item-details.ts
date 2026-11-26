import {
  type DatabaseClient,
  type LabCurrencyIcon,
  type LabItemDetailIconChange,
  type LabItemDetailInput,
  type LabItemDetailSummary,
  readLabItemDetailIcon,
  readLabItemDetails,
  saveLabItemDetail
} from '@dfragon/database'
import type { LabItemDetailRepository } from '#application/lab-item-details/repository.js'

export class DatabaseLabItemDetailRepository implements LabItemDetailRepository {
  constructor(private readonly client: DatabaseClient) {}

  readDetails(): Promise<LabItemDetailSummary[]> {
    return readLabItemDetails(this.client)
  }

  readIcon(itemName: string): Promise<LabCurrencyIcon | null> {
    return readLabItemDetailIcon(this.client, itemName)
  }

  save(itemName: string, input: LabItemDetailInput, icon: LabItemDetailIconChange): Promise<void> {
    return saveLabItemDetail(this.client, itemName, input, icon)
  }
}
