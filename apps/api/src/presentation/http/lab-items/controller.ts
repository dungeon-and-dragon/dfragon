import { Hono } from 'hono'
import type { LabItemService } from '#application/lab-items/index.js'
import type { LabItemsResponse } from './dto.js'

export class LabItemController {
  constructor(private readonly service: LabItemService) {}

  routes(): Hono {
    const routes = new Hono()

    routes.get('/items', async (c) => {
      const labItems: LabItemsResponse = await this.service.get()

      return c.json(labItems)
    })

    return routes
  }
}
