import { Hono } from 'hono'
import type { LabItemService } from '#application/lab-items/index.js'
import { OpsFailure } from '#domain/failure.js'
import { readJsonBody } from '#presentation/http/json-request.js'
import { replaceBody, toLabItemListResponse } from './dto.js'

export class LabItemController {
  constructor(private readonly service: LabItemService) {}

  routes(): Hono {
    const routes = new Hono()

    routes.get('/', async (c) => {
      const groups = await this.service.readGroups()

      return c.json(toLabItemListResponse(groups))
    })

    routes.put('/', async (c) => {
      const request = replaceBody.safeParse(await readJsonBody(c))

      if (!request.success) {
        throw new OpsFailure('request')
      }

      await this.service.replaceGroup(request.data)

      return c.body(null, 204)
    })

    return routes
  }
}
