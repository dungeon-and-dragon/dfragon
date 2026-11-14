import type { CollectionSummary } from '@dfragon/database'

export type OpsCollectionStore = {
  readSummary: () => Promise<CollectionSummary>
  requeue: (failure: string | undefined) => Promise<number>
}
