import {
  addLabCurrency,
  type DatabaseClient,
  type LabCurrencyAddition,
  type LabCurrencyIcon,
  type LabCurrencyInput,
  type LabCurrencySummary,
  type LabCurrencyUpdate,
  readLabCurrencies,
  readLabCurrencyIcon,
  updateLabCurrency
} from '@dfragon/database'
import type { LabCurrencyRepository } from '#application/lab-currencies/repository.js'

export class DatabaseLabCurrencyRepository implements LabCurrencyRepository {
  constructor(private readonly client: DatabaseClient) {}

  readCurrencies(): Promise<LabCurrencySummary[]> {
    return readLabCurrencies(this.client)
  }

  readIcon(id: number): Promise<LabCurrencyIcon | null> {
    return readLabCurrencyIcon(this.client, id)
  }

  add(input: LabCurrencyInput, icon: LabCurrencyIcon): Promise<LabCurrencyAddition> {
    return addLabCurrency(this.client, input, icon)
  }

  update(
    id: number,
    input: LabCurrencyInput,
    icon: LabCurrencyIcon | null
  ): Promise<LabCurrencyUpdate> {
    return updateLabCurrency(this.client, id, input, icon)
  }
}
