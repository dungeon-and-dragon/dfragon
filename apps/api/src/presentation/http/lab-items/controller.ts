import type { AccessLogEnv } from '@dfragon/http-server'
import { Hono } from 'hono'
import type { LabItemService } from '#application/lab-items/index.js'
import { respondUnlessDisconnected } from '#presentation/http/disconnected-request.js'
import { type LabItemsResponse, readCurrencyId, toEnchantOptionsResponse } from './dto.js'

// 아이콘 주소에 바꾼 시각이 들어가 같은 주소의 본문은 바뀌지 않는다.
const ICON_CACHE_CONTROL = 'public, max-age=31536000, immutable'

function iconHeaders(contentType: string) {
  return {
    'Content-Type': contentType,
    'Cache-Control': ICON_CACHE_CONTROL,
    'X-Content-Type-Options': 'nosniff'
  }
}

export class LabItemController {
  constructor(private readonly service: LabItemService) {}

  routes(): Hono<AccessLogEnv> {
    const routes = new Hono<AccessLogEnv>()

    routes.get('/items', (c) =>
      respondUnlessDisconnected(c, async (signal) => {
        const labItems: LabItemsResponse = await this.service.get(signal)

        return c.json(labItems)
      })
    )

    routes.get('/enchant-options', (c) =>
      respondUnlessDisconnected(c, async (signal) => {
        const [options, slotItems] = await this.service.simulatorOptions(signal)

        return c.json(toEnchantOptionsResponse(options, slotItems))
      })
    )

    routes.get('/currencies/:id/icon', async (c) => {
      const id = readCurrencyId(c.req.param('id'))

      if (id === null) {
        return c.notFound()
      }

      const icon = await this.service.readCurrencyIcon(id, c.req.query('v') ?? '')

      if (icon === null) {
        return c.notFound()
      }

      return c.body(icon.bytes, 200, iconHeaders(icon.contentType))
    })

    routes.get('/item-icon', async (c) => {
      const itemName = c.req.query('itemName')

      if (itemName === undefined || itemName === '') {
        return c.notFound()
      }

      const icon = await this.service.readItemIcon(itemName, c.req.query('v') ?? '')

      if (icon === null) {
        return c.notFound()
      }

      return c.body(icon.bytes, 200, iconHeaders(icon.contentType))
    })

    return routes
  }
}
