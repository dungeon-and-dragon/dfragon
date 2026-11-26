import {
  type DatabaseClient,
  type LabItemGroup,
  readLabItemGroups,
  replaceLabItemGroup
} from '@dfragon/database'
import type { LabItemRepository } from '#application/lab-items/repository.js'

export class DatabaseLabItemRepository implements LabItemRepository {
  constructor(private readonly client: DatabaseClient) {}

  readGroups(): Promise<LabItemGroup[]> {
    return readLabItemGroups(this.client)
  }

  replaceGroup(group: LabItemGroup): Promise<void> {
    return replaceLabItemGroup(this.client, group)
  }
}
