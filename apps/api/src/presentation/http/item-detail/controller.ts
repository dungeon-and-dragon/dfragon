import { type AccessLogEnv, createFailureHandler } from '@dfragon/http-server'
import { Hono } from 'hono'
import type { ItemDetailService } from '#application/item-detail/index.js'
import type { ItemDetail } from '#domain/item-detail/index.js'
import { respondUnlessDisconnected } from '#presentation/http/disconnected-request.js'
import { itemDetailFailureResponse } from './failures.js'

// 아이템 정보는 게임 패치 때만 바뀌어, 하루 동안 브라우저가 다시 묻지 않게 한다.
const ITEM_DETAIL_CACHE_CONTROL = 'public, max-age=86400'

export class ItemDetailController {
  constructor(private readonly service: ItemDetailService) {}

  routes(): Hono<AccessLogEnv> {
    const routes = new Hono<AccessLogEnv>()
    routes.onError(createFailureHandler(itemDetailFailureResponse))

    routes.get('/:itemId', (c) =>
      respondUnlessDisconnected(c, async (signal) => {
        const item: ItemDetail = await this.service.get(c.req.param('itemId'), signal)

        return c.json(item, 200, { 'Cache-Control': ITEM_DETAIL_CACHE_CONTROL })
      })
    )

    return routes
  }
}
