import { type AccessLogEnv, createFailureHandler } from '@dfragon/http-server'
import { Hono } from 'hono'
import type { SoulPriceService } from '#application/soul-prices/index.js'
import type { SoulPricesResponse } from './dto.js'
import { soulPriceFailureResponse } from './failures.js'

export class SoulPriceController {
  constructor(private readonly service: SoulPriceService) {}

  routes(): Hono<AccessLogEnv> {
    const routes = new Hono<AccessLogEnv>()
    routes.onError(createFailureHandler(soulPriceFailureResponse))

    routes.get('/soul-prices', async (c) => {
      const prices: SoulPricesResponse = await this.service.get()

      return c.json(prices)
    })

    return routes
  }
}
