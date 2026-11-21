import { type AccessLogEnv, createFailureHandler } from '@dfragon/http-server'
import { Hono } from 'hono'
import type { ItemDetailService } from '#application/item-detail/index.js'
import type { ItemDetail } from '#domain/item-detail/index.js'
import { respondUnlessDisconnected } from '#presentation/http/disconnected-request.js'
import { itemDetailFailureResponse } from './failures.js'

export class ItemDetailController {
  constructor(private readonly service: ItemDetailService) {}

  routes(): Hono<AccessLogEnv> {
    const routes = new Hono<AccessLogEnv>()
    routes.onError(createFailureHandler(itemDetailFailureResponse))

    routes.get('/:itemId', (c) =>
      respondUnlessDisconnected(c, async (signal) => {
        const item: ItemDetail = await this.service.get(c.req.param('itemId'), signal)

        return c.json(item)
      })
    )

    return routes
  }
}
