import { Hono } from 'hono'

export class HealthController {
  routes(): Hono {
    const routes = new Hono()

    routes.get('/', (c) => c.json({ status: 'ok' }))

    return routes
  }
}
