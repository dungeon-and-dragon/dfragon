import { Hono } from 'hono'
import { except } from 'hono/combine'
import type { BatchNeopleKeyRepository } from '#application/batch-neople-keys/repository.js'
import { BatchNeopleKeyService } from '#application/batch-neople-keys/index.js'
import type { CollectionRepository } from '#application/collection/repository.js'
import { CollectionService } from '#application/collection/index.js'
import type { JobRepository } from '#application/jobs/repository.js'
import { JobService } from '#application/jobs/index.js'
import type { LabCandidateRepository } from '#application/lab-candidates/repository.js'
import { LabCandidateService } from '#application/lab-candidates/index.js'
import type { LabCurrencyRepository } from '#application/lab-currencies/repository.js'
import { LabCurrencyService } from '#application/lab-currencies/index.js'
import type { LabItemDetailRepository } from '#application/lab-item-details/repository.js'
import { LabItemDetailService } from '#application/lab-item-details/index.js'
import type { LabItemRepository } from '#application/lab-items/repository.js'
import { LabItemService } from '#application/lab-items/index.js'
import type { QueueRepository } from '#application/queues/repository.js'
import { QueueService } from '#application/queues/index.js'
import { BatchNeopleKeyController } from '#presentation/http/batch-neople-keys/index.js'
import { CollectionController } from '#presentation/http/collection/index.js'
import { JobController } from '#presentation/http/jobs/index.js'
import {
  limitIconJsonBody,
  limitJsonBody,
  requireJsonContentType
} from '#presentation/http/json-request.js'
import { LabCandidateController } from '#presentation/http/lab-candidates/index.js'
import { LabCurrencyController } from '#presentation/http/lab-currencies/index.js'
import { LabItemDetailController } from '#presentation/http/lab-item-details/index.js'
import { LabItemController } from '#presentation/http/lab-items/index.js'
import { QueueController } from '#presentation/http/queues/index.js'

// 아이콘을 base64로 받는 경로다.
const ICON_PATHS = ['/api/lab-currencies/*', '/api/lab-item-details/*', '/api/lab-candidates/icon']

export interface OpsRouteOptions {
  readonly jobs: JobRepository
  readonly readQueueCounts: QueueRepository['readCounts']
  readonly collection: CollectionRepository
  readonly batchNeopleKeys: BatchNeopleKeyRepository
  readonly labItems: LabItemRepository
  readonly labCurrencies: LabCurrencyRepository
  readonly labItemDetails: LabItemDetailRepository
  readonly labCandidates: LabCandidateRepository
}

export function createOpsRoutes({
  jobs,
  readQueueCounts,
  collection,
  batchNeopleKeys,
  labItems,
  labCurrencies,
  labItemDetails,
  labCandidates
}: OpsRouteOptions): Hono {
  const queues: QueueRepository = { readCounts: readQueueCounts }
  const jobController = new JobController(new JobService(jobs))
  const queueController = new QueueController(new QueueService(queues))
  const collectionController = new CollectionController(new CollectionService(collection))
  const batchNeopleKeyController = new BatchNeopleKeyController(
    new BatchNeopleKeyService(batchNeopleKeys)
  )
  const labItemController = new LabItemController(new LabItemService(labItems, labCurrencies))
  const labCurrencyController = new LabCurrencyController(new LabCurrencyService(labCurrencies))
  const labItemDetailController = new LabItemDetailController(
    new LabItemDetailService(labItemDetails)
  )
  const labCandidateController = new LabCandidateController(new LabCandidateService(labCandidates))
  const routes = new Hono()

  routes.use(requireJsonContentType, except(ICON_PATHS, limitJsonBody))

  for (const path of ICON_PATHS) {
    routes.use(path, limitIconJsonBody)
  }

  routes.route('/api/jobs', jobController.routes())
  routes.route('/api/queues', queueController.routes())
  routes.route('/api/collection', collectionController.routes())
  routes.route('/api/batch-neople-keys', batchNeopleKeyController.routes())
  routes.route('/api/lab-items', labItemController.routes())
  routes.route('/api/lab-currencies', labCurrencyController.routes())
  routes.route('/api/lab-item-details', labItemDetailController.routes())
  routes.route('/api/lab-candidates', labCandidateController.routes())

  return routes
}
