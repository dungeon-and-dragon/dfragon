import { Hono } from 'hono'
import type {
  OpsBatchNeopleKeyStore,
  OpsCollectionStore,
  OpsJobStore,
  ReadQueueCounts
} from '../../application/ops/ports.js'
import { createOpsBatchNeopleKeyRoutes } from '../../presentation/http/ops/batch-neople-keys.js'
import { createOpsCollectionRoutes } from '../../presentation/http/ops/collection.js'
import { createOpsJobRoutes } from '../../presentation/http/ops/jobs.js'
import { limitJsonBody, requireJsonContentType } from '../../presentation/http/ops/json-request.js'
import { createOpsQueueRoutes } from '../../presentation/http/ops/queues.js'

export interface OpsRouteOptions {
  readonly jobs: OpsJobStore
  readonly readQueueCounts: ReadQueueCounts
  readonly collection: OpsCollectionStore
  readonly batchNeopleKeys: OpsBatchNeopleKeyStore
}

export function createOpsRoutes({
  jobs,
  readQueueCounts,
  collection,
  batchNeopleKeys
}: OpsRouteOptions): Hono {
  const routes = new Hono()
  routes.use(requireJsonContentType, limitJsonBody)
  routes.route('/api/jobs', createOpsJobRoutes(jobs))
  routes.route('/api/queues', createOpsQueueRoutes(readQueueCounts))
  routes.route('/api/collection', createOpsCollectionRoutes(collection))
  routes.route('/api/batch-neople-keys', createOpsBatchNeopleKeyRoutes(batchNeopleKeys))

  return routes
}
