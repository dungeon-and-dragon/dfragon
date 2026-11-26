import type { LabItemGroup } from '@dfragon/database'
import type { LabCurrencyRepository } from '#application/lab-currencies/repository.js'
import { OpsFailure } from '#domain/failure.js'
import type { LabItemRepository } from './repository.js'

export class LabItemService {
  constructor(
    private readonly repository: LabItemRepository,
    private readonly currencies: Pick<LabCurrencyRepository, 'readCurrencies'>
  ) {}

  readGroups(): Promise<LabItemGroup[]> {
    return this.repository.readGroups()
  }

  // 재화는 지우는 경로가 없어, 저장 직전에 확인한 재화가 저장 중에 사라지지 않는다.
  async replaceGroup(group: LabItemGroup): Promise<void> {
    const currencies = await this.currencies.readCurrencies()
    const currencyIds = new Set(currencies.map(({ id }) => id))
    const unknownCost = group.items.some(
      ({ cost }) => cost !== null && !currencyIds.has(cost.currencyId)
    )

    if (unknownCost) {
      throw new OpsFailure('labCurrencyNotFound')
    }

    await this.repository.replaceGroup(group)
  }
}
