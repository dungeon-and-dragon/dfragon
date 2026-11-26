import { type DatabaseConfiguration, createDatabaseClient } from '@dfragon/database'
import {
  DatabaseBatchNeopleKeyRepository,
  DatabaseCollectionRepository,
  DatabaseJobRepository,
  DatabaseLabCurrencyRepository,
  DatabaseLabItemDetailRepository,
  DatabaseLabItemRepository,
  DatabaseQueueRepository
} from '#infrastructure/database/index.js'
import { createOpsHttpApp } from './ops-app.js'

export function createOpsRuntime(database: DatabaseConfiguration) {
  const client = createDatabaseClient(database)
  const queues = new DatabaseQueueRepository(client)

  return createOpsHttpApp({
    jobs: new DatabaseJobRepository(client),
    readQueueCounts: () => queues.readCounts(),
    collection: new DatabaseCollectionRepository(client),
    batchNeopleKeys: new DatabaseBatchNeopleKeyRepository(client),
    labItems: new DatabaseLabItemRepository(client),
    labCurrencies: new DatabaseLabCurrencyRepository(client),
    labItemDetails: new DatabaseLabItemDetailRepository(client),
    close: () => client.$disconnect()
  })
}
