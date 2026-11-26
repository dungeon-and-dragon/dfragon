import type {
  LabCurrencyAddition,
  LabCurrencyIcon,
  LabCurrencyInput,
  LabCurrencySummary,
  LabCurrencyUpdate
} from '@dfragon/database'

export interface LabCurrencyRepository {
  readCurrencies(): Promise<LabCurrencySummary[]>
  readIcon(id: number): Promise<LabCurrencyIcon | null>
  add(input: LabCurrencyInput, icon: LabCurrencyIcon): Promise<LabCurrencyAddition>
  update(
    id: number,
    input: LabCurrencyInput,
    icon: LabCurrencyIcon | null
  ): Promise<LabCurrencyUpdate>
}
