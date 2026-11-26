import {
  addLabCurrency,
  type DatabaseClient,
  type LabCurrencyAddition,
  type LabCurrencyIcon,
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

  add(name: string, icon: LabCurrencyIcon): Promise<LabCurrencyAddition> {
    return addLabCurrency(this.client, name, icon)
  }

  update(id: number, name: string, icon: LabCurrencyIcon | null): Promise<LabCurrencyUpdate> {
    return updateLabCurrency(this.client, id, name, icon)
  }
}
