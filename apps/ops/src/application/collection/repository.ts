import type { CollectionSummary } from '@dfragon/database'

export interface CollectionRepository {
  readSummary(): Promise<CollectionSummary>
  requeue(failure: string | undefined): Promise<number>
}
