import {
  type CollectionSummary,
  type DatabaseClient,
  readCollectionSummary,
  requeueCollectionFailures
} from '@dfragon/database'
import type { CollectionRepository } from '../../application/collection/repository.js'

export class DatabaseCollectionRepository implements CollectionRepository {
  constructor(private readonly client: DatabaseClient) {}

  readSummary(): Promise<CollectionSummary> {
    return readCollectionSummary(this.client)
  }

  requeue(failure: string | undefined): Promise<number> {
    return requeueCollectionFailures(this.client, failure)
  }
}
