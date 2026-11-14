import { Hono } from 'hono'
import type { BatchNeopleKeyRepository } from '../../application/batch-neople-keys/repository.js'
import { BatchNeopleKeyService } from '../../application/batch-neople-keys/service.js'
import type { CollectionRepository } from '../../application/collection/repository.js'
import { CollectionService } from '../../application/collection/service.js'
import type { JobRepository } from '../../application/jobs/repository.js'
import { JobService } from '../../application/jobs/service.js'
import type { QueueRepository } from '../../application/queues/repository.js'
import { QueueService } from '../../application/queues/service.js'
import { BatchNeopleKeyController } from '../../presentation/http/batch-neople-keys/controller.js'
import { CollectionController } from '../../presentation/http/collection/controller.js'
import { JobController } from '../../presentation/http/jobs/controller.js'
import { limitJsonBody, requireJsonContentType } from '../../presentation/http/json-request.js'
import { QueueController } from '../../presentation/http/queues/controller.js'

export interface OpsRouteOptions {
  readonly jobs: JobRepository
  readonly readQueueCounts: QueueRepository['readCounts']
  readonly collection: CollectionRepository
  readonly batchNeopleKeys: BatchNeopleKeyRepository
}

export function createOpsRoutes({
  jobs,
  readQueueCounts,
  collection,
  batchNeopleKeys
}: OpsRouteOptions): Hono {
  const queues: QueueRepository = { readCounts: readQueueCounts }
  const jobController = new JobController(new JobService(jobs))
  const queueController = new QueueController(new QueueService(queues))
  const collectionController = new CollectionController(new CollectionService(collection))
  const batchNeopleKeyController = new BatchNeopleKeyController(
    new BatchNeopleKeyService(batchNeopleKeys)
  )
  const routes = new Hono()

  routes.use(requireJsonContentType, limitJsonBody)
  routes.route('/api/jobs', jobController.routes())
  routes.route('/api/queues', queueController.routes())
  routes.route('/api/collection', collectionController.routes())
  routes.route('/api/batch-neople-keys', batchNeopleKeyController.routes())

  return routes
}
