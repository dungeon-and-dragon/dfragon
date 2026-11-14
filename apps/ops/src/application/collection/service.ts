import type { CollectionSummary } from '@dfragon/database'
import type { CollectionRepository } from './repository.js'

export class CollectionService {
  constructor(private readonly repository: CollectionRepository) {}

  readSummary(): Promise<CollectionSummary> {
    return this.repository.readSummary()
  }

  requeue(failure: string | undefined): Promise<number> {
    return this.repository.requeue(failure)
  }
}
