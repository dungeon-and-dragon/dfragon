import { Hono } from 'hono'
import type { OpsBatchNeopleKeyStore } from '../../application/batch-neople-keys/ports.js'
import type { OpsCollectionStore } from '../../application/collection/ports.js'
import type { OpsJobStore } from '../../application/jobs/ports.js'
import type { ReadQueueCounts } from '../../application/queues/ports.js'
import { createOpsBatchNeopleKeyRoutes } from '../../presentation/http/batch-neople-keys/routes.js'
import { createOpsCollectionRoutes } from '../../presentation/http/collection/routes.js'
import { createOpsJobRoutes } from '../../presentation/http/jobs/routes.js'
import { limitJsonBody, requireJsonContentType } from '../../presentation/http/json-request.js'
import { createOpsQueueRoutes } from '../../presentation/http/queues/routes.js'

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
