import { type DatabaseClient, readLabItemNames } from '@dfragon/database'
import type { LabItemRepository } from '#application/auction-prices/repository.js'

export class DatabaseLabItemRepository implements LabItemRepository {
  constructor(private readonly client: DatabaseClient) {}

  readItemNames(): Promise<string[]> {
    return readLabItemNames(this.client)
  }
}
