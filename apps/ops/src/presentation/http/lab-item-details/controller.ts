import { Hono } from 'hono'
import type { LabItemDetailService } from '#application/lab-item-details/index.js'
import { OpsFailure } from '#domain/failure.js'
import { readJsonBody } from '#presentation/http/json-request.js'
import { readItemName } from '#presentation/http/lab-fields.js'
import { saveBody, toLabItemDetailListResponse } from './dto.js'

export class LabItemDetailController {
  constructor(private readonly service: LabItemDetailService) {}

  routes(): Hono {
    const routes = new Hono()

    routes.get('/', async (c) => {
      const details = await this.service.readDetails()

      return c.json(toLabItemDetailListResponse(details))
    })

    // 아이템 이름에 쉼표, 괄호, 공백이 들어가 경로 대신 query로 받는다.
    routes.get('/icon', async (c) => {
      const itemName = readItemName(c.req.query('itemName'))
      const { bytes, contentType } = await this.service.readIcon(itemName)

      return c.body(bytes, 200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      })
    })

    routes.put('/', async (c) => {
      const request = saveBody.safeParse(await readJsonBody(c))

      if (!request.success) {
        throw new OpsFailure('request')
      }

      const { itemName, icon, ...input } = request.data
      await this.service.save(itemName, input, icon)

      return c.body(null, 204)
    })

    return routes
  }
}
