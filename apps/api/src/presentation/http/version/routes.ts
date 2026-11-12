import type { ServerBuildInfo } from '@dfragon/lib'
import { Hono } from 'hono'

export function createVersionRoutes(buildInfo: ServerBuildInfo): Hono {
  const routes = new Hono()

  routes.get('/', (c) => c.json(buildInfo))

  return routes
}
