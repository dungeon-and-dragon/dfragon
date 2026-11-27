import { Hono } from 'hono'
import type { LabCandidateService } from '#application/lab-candidates/index.js'
import { OpsFailure } from '#domain/failure.js'
import { readJsonBody } from '#presentation/http/json-request.js'
import { readItemName } from '#presentation/http/lab-fields.js'
import {
  batchBody,
  finishBody,
  iconBody,
  readListQuery,
  toLabCandidateListResponse,
  toLabCandidatePriceHistoryResponse
} from './dto.js'

export class LabCandidateController {
  constructor(private readonly service: LabCandidateService) {}

  routes(): Hono {
    const routes = new Hono()

    routes.get('/', async (c) => {
      const query = readListQuery(c.req.query())
      const candidates = await this.service.readCandidates(query)

      return c.json(toLabCandidateListResponse(candidates))
    })

    // 아이템 이름에 쉼표, 괄호, 공백이 들어가 경로 대신 query로 받는다.
    routes.get('/history', async (c) => {
      const itemName = readItemName(c.req.query('itemName'))
      const history = await this.service.readPriceHistory(itemName)

      return c.json(toLabCandidatePriceHistoryResponse(history))
    })

    routes.get('/icon', async (c) => {
      const itemName = readItemName(c.req.query('itemName'))
      const { bytes, contentType } = await this.service.readIcon(itemName)

      return c.body(bytes, 200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      })
    })

    routes.put('/batch', async (c) => {
      const request = batchBody.safeParse(await readJsonBody(c))

      if (!request.success) {
        throw new OpsFailure('request')
      }

      const { snapshotId, items } = request.data
      await this.service.importBatch(snapshotId, items)

      return c.body(null, 204)
    })

    routes.put('/icon', async (c) => {
      const request = iconBody.safeParse(await readJsonBody(c))

      if (!request.success) {
        throw new OpsFailure('request')
      }

      const { itemName, icon } = request.data
      await this.service.saveIcon(itemName, icon)

      return c.body(null, 204)
    })

    routes.post('/finish', async (c) => {
      const request = finishBody.safeParse(await readJsonBody(c))

      if (!request.success) {
        throw new OpsFailure('request')
      }

      const result = await this.service.finish(request.data.snapshotId)

      return c.json(result)
    })

    return routes
  }
}
