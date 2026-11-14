import type { ServerBuildInfo } from '@dfragon/lib'
import { Hono } from 'hono'

export class VersionController {
  constructor(private readonly buildInfo: ServerBuildInfo) {}

  routes(): Hono {
    const routes = new Hono()

    routes.get('/', (c) => c.json(this.buildInfo))

    return routes
  }
}
