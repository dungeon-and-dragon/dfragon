import { Hono } from 'hono'
import type { CollectionService } from '../../../application/collection/service.js'
import { OpsFailure } from '../../../domain/failure.js'
import { readJsonBody } from '../json-request.js'
import { type CollectionSummaryResponse, requeueBody, toRequeueResponse } from './dto.js'

// 집계가 대기열 테이블 전체를 읽으므로 자주 다시 읽는 job 목록 경로와 나눠 둔다.
export class CollectionController {
  constructor(private readonly service: CollectionService) {}

  routes(): Hono {
    const routes = new Hono()

    routes.get('/', async (c) => {
      const summary: CollectionSummaryResponse = await this.service.readSummary()

      return c.json(summary)
    })

    routes.post('/requeue', async (c) => {
      const request = requeueBody.safeParse(await readJsonBody(c))

      if (!request.success) {
        throw new OpsFailure('request')
      }

      const requeued = await this.service.requeue(request.data.failure)

      return c.json(toRequeueResponse(requeued))
    })

    return routes
  }
}
