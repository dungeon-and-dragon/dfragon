import type {
  BatchNeopleKeyAddition,
  BatchNeopleKeyInput,
  BatchNeopleKeySummary,
  CollectionSummary,
  JobOverview,
  JobPauseChange,
  JobRunRecord,
  JobRunRequest
} from '@dfragon/database'

export type OpsJobStore = {
  readOverviews: () => Promise<JobOverview[]>
  readRuns: (
    name: string,
    page: { before: number | undefined; limit: number }
  ) => Promise<JobRunRecord[] | undefined>
  requestRun: (name: string, args: unknown) => Promise<JobRunRequest>
  setPaused: (name: string, paused: boolean) => Promise<JobPauseChange>
}

export type OpsCollectionStore = {
  readSummary: () => Promise<CollectionSummary>
  requeue: (failure: string | undefined) => Promise<number>
}

export type OpsBatchNeopleKeyStore = {
  readKeys: () => Promise<BatchNeopleKeySummary[]>
  add: (input: BatchNeopleKeyInput) => Promise<BatchNeopleKeyAddition>
  setEnabled: (id: number, enabled: boolean) => Promise<boolean>
  delete: (id: number) => Promise<boolean>
}

export type OpsQueueCount = {
  readonly name: string
  readonly waiting: number
  readonly running: number
}

export type ReadQueueCounts = () => Promise<readonly OpsQueueCount[]>
