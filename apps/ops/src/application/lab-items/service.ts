import type { LabItemGroup } from '@dfragon/database'
import type { LabItemRepository } from './repository.js'

export class LabItemService {
  constructor(private readonly repository: LabItemRepository) {}

  readGroups(): Promise<LabItemGroup[]> {
    return this.repository.readGroups()
  }

  replaceGroup(group: LabItemGroup): Promise<void> {
    return this.repository.replaceGroup(group)
  }
}
