import type {
  LabCurrencyIcon,
  LabItemDetailIconChange,
  LabItemDetailInput,
  LabItemDetailSummary
} from '@dfragon/database'

export interface LabItemDetailRepository {
  readDetails(): Promise<LabItemDetailSummary[]>
  readIcon(itemName: string): Promise<LabCurrencyIcon | null>
  save(itemName: string, input: LabItemDetailInput, icon: LabItemDetailIconChange): Promise<void>
}
