import type {
  LabCurrencyAddition,
  LabCurrencyIcon,
  LabCurrencySummary,
  LabCurrencyUpdate
} from '@dfragon/database'

export interface LabCurrencyRepository {
  readCurrencies(): Promise<LabCurrencySummary[]>
  readIcon(id: number): Promise<LabCurrencyIcon | null>
  add(name: string, icon: LabCurrencyIcon): Promise<LabCurrencyAddition>
  update(id: number, name: string, icon: LabCurrencyIcon | null): Promise<LabCurrencyUpdate>
}
