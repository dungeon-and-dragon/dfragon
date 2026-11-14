import { Hono } from 'hono'
import type { BatchNeopleKeyService } from '../../../application/batch-neople-keys/service.js'
import { OpsFailure } from '../../../domain/failure.js'
import { readJsonBody } from '../json-request.js'
import {
  addBody,
  readKeyId,
  toBatchNeopleKeyAdditionResponse,
  toBatchNeopleKeyListResponse
} from './dto.js'

export class BatchNeopleKeyController {
  constructor(private readonly service: BatchNeopleKeyService) {}

  routes(): Hono {
    const routes = new Hono()

    routes.get('/', async (c) => {
      const keys = await this.service.readKeys()

      return c.json(toBatchNeopleKeyListResponse(keys))
    })

    routes.post('/', async (c) => {
      const request = addBody.safeParse(await readJsonBody(c))

      if (!request.success) {
        throw new OpsFailure('request')
      }

      const id = await this.service.add(request.data)

      return c.json(toBatchNeopleKeyAdditionResponse(id), 201)
    })

    routes.post('/:id/enable', async (c) => {
      const id = readKeyId(c.req.param('id'))
      await this.service.setEnabled(id, true)

      return c.body(null, 204)
    })

    routes.post('/:id/disable', async (c) => {
      const id = readKeyId(c.req.param('id'))
      await this.service.setEnabled(id, false)

      return c.body(null, 204)
    })

    routes.delete('/:id', async (c) => {
      const id = readKeyId(c.req.param('id'))
      await this.service.delete(id)

      return c.body(null, 204)
    })

    return routes
  }
}
