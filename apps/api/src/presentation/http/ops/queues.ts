import { Hono } from 'hono'
import type { ReadQueueCounts } from '../../../application/ops/ports.js'

export function createOpsQueueRoutes(readCounts: ReadQueueCounts): Hono {
  const routes = new Hono()

  routes.get('/', (c) => c.json({ queues: readCounts() }))

  return routes
}
