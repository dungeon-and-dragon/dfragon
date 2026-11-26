import type { LabCurrencyIcon, LabCurrencySummary } from '@dfragon/database'
import { OpsFailure } from '#domain/failure.js'
import type { LabCurrencyRepository } from './repository.js'

export class LabCurrencyService {
  constructor(private readonly repository: LabCurrencyRepository) {}

  readCurrencies(): Promise<LabCurrencySummary[]> {
    return this.repository.readCurrencies()
  }

  async readIcon(id: number): Promise<LabCurrencyIcon> {
    const icon = await this.repository.readIcon(id)

    if (icon === null) {
      throw new OpsFailure('labCurrencyNotFound')
    }

    return icon
  }

  async add(name: string, icon: LabCurrencyIcon): Promise<number> {
    const addition = await this.repository.add(name, icon)

    if (addition.status === 'duplicate') {
      throw new OpsFailure('labCurrencyDuplicate')
    }

    return addition.id
  }

  async update(id: number, name: string, icon: LabCurrencyIcon | null): Promise<void> {
    const { status } = await this.repository.update(id, name, icon)

    if (status === 'duplicate') {
      throw new OpsFailure('labCurrencyDuplicate')
    }

    if (status === 'notFound') {
      throw new OpsFailure('labCurrencyNotFound')
    }
  }
}
