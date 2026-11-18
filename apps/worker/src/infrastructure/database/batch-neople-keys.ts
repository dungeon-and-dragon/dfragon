import {
  type DatabaseClient,
  type UsableBatchNeopleKey,
  readUsableBatchNeopleKeys,
  recordBatchNeopleKeyRejected
} from '@dfragon/database'
import type { BatchNeopleKeyRepository } from '#infrastructure/neople/index.js'

export class DatabaseBatchNeopleKeyRepository implements BatchNeopleKeyRepository {
  constructor(private readonly client: DatabaseClient) {}

  readUsableKeys(): Promise<UsableBatchNeopleKey[]> {
    return readUsableBatchNeopleKeys(this.client)
  }

  recordRejected(id: number): Promise<void> {
    return recordBatchNeopleKeyRejected(this.client, id)
  }
}
