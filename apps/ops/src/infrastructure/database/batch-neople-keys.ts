import {
  type BatchNeopleKeyAddition,
  type BatchNeopleKeyInput,
  type BatchNeopleKeySummary,
  type DatabaseClient,
  addBatchNeopleKey,
  deleteBatchNeopleKey,
  readBatchNeopleKeys,
  setBatchNeopleKeyEnabled
} from '@dfragon/database'
import type { BatchNeopleKeyRepository } from '../../application/batch-neople-keys/repository.js'

export class DatabaseBatchNeopleKeyRepository implements BatchNeopleKeyRepository {
  constructor(private readonly client: DatabaseClient) {}

  readKeys(): Promise<BatchNeopleKeySummary[]> {
    return readBatchNeopleKeys(this.client)
  }

  add(input: BatchNeopleKeyInput): Promise<BatchNeopleKeyAddition> {
    return addBatchNeopleKey(this.client, input)
  }

  setEnabled(id: number, enabled: boolean): Promise<boolean> {
    return setBatchNeopleKeyEnabled(this.client, id, enabled)
  }

  delete(id: number): Promise<boolean> {
    return deleteBatchNeopleKey(this.client, id)
  }
}
