import {
  type DatabaseConfiguration,
  addBatchNeopleKey,
  createDatabaseClient,
  deleteBatchNeopleKey,
  readBatchNeopleKeys,
  readCollectionSummary,
  readJobOverviews,
  readJobRuns,
  readTimelineQueueCounts,
  requestJobRun,
  requeueCollectionFailures,
  setBatchNeopleKeyEnabled,
  setJobPaused
} from '@dfragon/database'
import { createOpsHttpApp } from './ops-app.js'

export function createOpsRuntime(database: DatabaseConfiguration) {
  const client = createDatabaseClient(database)

  return createOpsHttpApp({
    jobs: {
      readOverviews: () => readJobOverviews(client),
      readRuns: (name, page) => readJobRuns(client, name, page),
      requestRun: (name, args) => requestJobRun(client, name, args),
      setPaused: (name, paused) => setJobPaused(client, name, paused)
    },
    readQueueCounts: () => readTimelineQueueCounts(client),
    collection: {
      readSummary: () => readCollectionSummary(client),
      requeue: (failure) => requeueCollectionFailures(client, failure)
    },
    batchNeopleKeys: {
      readKeys: () => readBatchNeopleKeys(client),
      add: (input) => addBatchNeopleKey(client, input),
      setEnabled: (id, enabled) => setBatchNeopleKeyEnabled(client, id, enabled),
      delete: (id) => deleteBatchNeopleKey(client, id)
    },
    close: () => client.$disconnect()
  })
}
