import type { BatchNeopleKeyInput, BatchNeopleKeySummary } from '@dfragon/database'
import { OpsFailure } from '../../domain/failure.js'
import type { BatchNeopleKeyRepository } from './repository.js'

function throwWhenMissing(found: boolean): void {
  if (!found) {
    throw new OpsFailure('batchNeopleKeyNotFound')
  }
}

export class BatchNeopleKeyService {
  constructor(private readonly repository: BatchNeopleKeyRepository) {}

  readKeys(): Promise<BatchNeopleKeySummary[]> {
    return this.repository.readKeys()
  }

  async add(input: BatchNeopleKeyInput): Promise<number> {
    const addition = await this.repository.add(input)

    if (addition.status === 'duplicate') {
      throw new OpsFailure('batchNeopleKeyDuplicate')
    }

    return addition.id
  }

  async setEnabled(id: number, enabled: boolean): Promise<void> {
    throwWhenMissing(await this.repository.setEnabled(id, enabled))
  }

  async delete(id: number): Promise<void> {
    throwWhenMissing(await this.repository.delete(id))
  }
}
