import type { LabItemGroup } from '@dfragon/database'

export interface LabItemRepository {
  readGroups(): Promise<LabItemGroup[]>
  replaceGroup(group: LabItemGroup): Promise<void>
}
