import { Hono } from 'hono'
import type { LabCurrencyService } from '#application/lab-currencies/index.js'
import { OpsFailure } from '#domain/failure.js'
import { readJsonBody } from '#presentation/http/json-request.js'
import {
  addBody,
  readCurrencyId,
  toLabCurrencyAdditionResponse,
  toLabCurrencyListResponse,
  updateBody
} from './dto.js'

export class LabCurrencyController {
  constructor(private readonly service: LabCurrencyService) {}

  routes(): Hono {
    const routes = new Hono()

    routes.get('/', async (c) => {
      const currencies = await this.service.readCurrencies()

      return c.json(toLabCurrencyListResponse(currencies))
    })

    routes.get('/:id/icon', async (c) => {
      const id = readCurrencyId(c.req.param('id'))
      const { bytes, contentType } = await this.service.readIcon(id)

      return c.body(bytes, 200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      })
    })

    routes.post('/', async (c) => {
      const request = addBody.safeParse(await readJsonBody(c))

      if (!request.success) {
        throw new OpsFailure('request')
      }

      const { name, description, icon } = request.data
      const id = await this.service.add({ name, description }, icon)

      return c.json(toLabCurrencyAdditionResponse(id), 201)
    })

    routes.put('/:id', async (c) => {
      const id = readCurrencyId(c.req.param('id'))
      const request = updateBody.safeParse(await readJsonBody(c))

      if (!request.success) {
        throw new OpsFailure('request')
      }

      const { name, description, icon } = request.data
      await this.service.update(id, { name, description }, icon ?? null)

      return c.body(null, 204)
    })

    return routes
  }
}
