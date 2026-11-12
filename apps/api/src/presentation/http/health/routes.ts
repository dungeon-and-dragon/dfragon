import { Hono } from 'hono'

export function createHealthRoutes(): Hono {
  const routes = new Hono()

  routes.get('/', (c) => c.json({ status: 'ok' }))

  return routes
}
