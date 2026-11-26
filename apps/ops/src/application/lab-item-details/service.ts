import type {
  LabCurrencyIcon,
  LabItemDetailIconChange,
  LabItemDetailInput,
  LabItemDetailSummary
} from '@dfragon/database'
import { OpsFailure } from '#domain/failure.js'
import type { LabItemDetailRepository } from './repository.js'

export class LabItemDetailService {
  constructor(private readonly repository: LabItemDetailRepository) {}

  readDetails(): Promise<LabItemDetailSummary[]> {
    return this.repository.readDetails()
  }

  async readIcon(itemName: string): Promise<LabCurrencyIcon> {
    const icon = await this.repository.readIcon(itemName)

    if (icon === null) {
      throw new OpsFailure('labItemIconNotFound')
    }

    return icon
  }

  save(itemName: string, input: LabItemDetailInput, icon: LabItemDetailIconChange): Promise<void> {
    return this.repository.save(itemName, input, icon)
  }
}
