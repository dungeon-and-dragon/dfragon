import { type DatabaseConfiguration, createDatabaseClient } from '@dfragon/database'
import { DatabaseBatchNeopleKeyRepository } from '../infrastructure/database/batch-neople-keys.js'
import { DatabaseCollectionRepository } from '../infrastructure/database/collection.js'
import { DatabaseJobRepository } from '../infrastructure/database/jobs.js'
import { DatabaseQueueRepository } from '../infrastructure/database/queues.js'
import { createOpsHttpApp } from './ops-app.js'

export function createOpsRuntime(database: DatabaseConfiguration) {
  const client = createDatabaseClient(database)
  const queues = new DatabaseQueueRepository(client)

  return createOpsHttpApp({
    jobs: new DatabaseJobRepository(client),
    readQueueCounts: () => queues.readCounts(),
    collection: new DatabaseCollectionRepository(client),
    batchNeopleKeys: new DatabaseBatchNeopleKeyRepository(client),
    close: () => client.$disconnect()
  })
}
