import { Hono } from 'hono'
import type { QueueService } from '../../../application/queues/service.js'
import { toQueueListResponse } from './dto.js'

export class QueueController {
  constructor(private readonly service: QueueService) {}

  routes(): Hono {
    const routes = new Hono()

    routes.get('/', async (c) => {
      const queues = await this.service.readCounts()

      return c.json(toQueueListResponse(queues))
    })

    return routes
  }
}
